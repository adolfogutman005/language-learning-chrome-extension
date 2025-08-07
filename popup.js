// Constants
const models = {
  cohere: "cohere/cohere-command-a",
  openai: "gpt-4o-mini",
  mistral: "mistral-ai/mistral-small-2503"
};

const MODEL_ID = models.openai;

// Load API keys from secrets file
let GITHUB_TOKEN = null;

// Try to load secrets from secrets.js file
try {
  // For Chrome extension context, we need to load the script dynamically
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('secrets.js');
  script.onload = function() {
    if (typeof SECRETS !== 'undefined' && SECRETS.GITHUB_TOKEN) {
      GITHUB_TOKEN = SECRETS.GITHUB_TOKEN;
      console.log('GitHub token loaded successfully');
    } else {
      console.warn('GitHub token not found in secrets.js. Please add your token to secrets.js file.');
      showTokenError();
    }
  };
  script.onerror = function() {
    console.error('Failed to load secrets.js file. Please create secrets.js with your GitHub token.');
    showTokenError();
  };
  document.head.appendChild(script);
} catch (error) {
  console.error('Error loading secrets:', error);
  showTokenError();
}

// Function to show error when token is not available
function showTokenError() {
  const errorMessage = `
    <div style="background: #ff4444; color: white; padding: 12px; border-radius: 8px; margin: 10px 0;">
      <strong>⚠️ API Key Required</strong><br>
      Please create a <code>secrets.js</code> file with your GitHub API key.<br>
      See the README for setup instructions.
    </div>
  `;
  
  // Add error message to the popup
  const resultsSection = document.getElementById('results');
  if (resultsSection) {
    resultsSection.innerHTML = errorMessage;
  }
}

// Navigation functionality
function initializeNavigation() {
  const navTabs = document.querySelectorAll('.nav-tab');
  const pages = document.querySelectorAll('.page');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPage = tab.getAttribute('data-page');
      
      // Update active tab
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show/hide pages
      pages.forEach(page => {
        if (page.id === `${targetPage}-page`) {
          page.classList.remove('hidden');
        } else {
          page.classList.add('hidden');
        }
      });
    });
  });
}

// Writing feedback functionality
async function getWritingFeedback(text) {
  if (!text.trim()) {
    alert('Please enter some text to get feedback.');
    return;
  }

  const url = "https://models.github.ai/inference/chat/completions";
  
  const prompt = `You are a language learning assistant. Analyze the following text and detect the language automatically:

"${text}"

Provide feedback in the following JSON format (respond with ONLY the JSON, no other text):
{
  "language_detected": "en/es/fr/etc",
  "is_correct": true/false,
  "corrected_version": "The corrected version of the text",
  "natural_version": {
    "text": "A more natural way to express the same idea (or 'Already Natural' if no improvement needed)",
    "explanation": "Why this version is more natural (idioms, phrasal verbs, better vocabulary, etc.) in relation to the other"
  },
  "mistakes": [
    {
      "error": "Description of the specific mistake",
      "correction": "How to fix it",
      "grammar_concept": "Specific grammar concept (e.g., 'Verb to be in present tense', 'Conjunctions for simultaneous actions', 'Subject-verb agreement')",
      "severity": 1-3 
      (1 = minor grammar errors, such as issues with style, redundant phrasing, incorrect collocations, wordiness, awkward phrasing, or idiomatic expression errors. 
      Example: "Despite of the weather, we went out." → Correct: "Despite the weather")

      (2 = medium grammar errors, such as incorrect use of articles, prepositions, countable/uncountable nouns, or incorrect word forms. 
      Example: "She is good in singing." → Correct: "She is good at singing.")

      (3 = critical grammar errors, such as subject-verb agreement mistakes, basic verb conjugation errors, pronoun mismatches, or tense mismatches. These are fundamental errors that seriously affect meaning and clarity. 
      Example: "I are your father." → Correct: "I am your father.")
  ],
  "learned_concepts": [
    "Specific grammar concept 1",
    "Specific grammar concept 2"
  ]
}

IMPORTANT GUIDELINES:
- Be VERY specific with grammar concepts (e.g., "Past perfect continuous tense" not "Verb tenses" or "Idiomatic expressions in English"). Use the exact verbs involved, tenses, vocabulary, etc.
- Severity levels: 1=minor suggestion, 2=grammar error, 3=critical error
- If text is correct, set is_correct=true and corrected_version="Perfect! No Mistakes Found"
- Only include learned_concepts if there are actual mistakes
- Each mistake should be explained separately with its own grammar concept
- For natural_version: ONLY suggest improvements if the text is GRAMMATICALLY CORRECT but could be more idiomatic or native-like. If there are grammar errors, focus on fixing those first. Only use "Already Natural" if the text is both grammatically correct AND already sounds natural to native speakers.
- CRITICAL: Grammar errors should NEVER be marked as "Already Natural". If there are grammar mistakes, the natural_version should suggest a more natural way to express the same meaning AFTER fixing the grammar.
- Focus on the most important mistakes first`;

  try {
    // Check if token is available
    if (!GITHUB_TOKEN) {
      throw new Error('GitHub API token not available. Please add your token to secrets.js file.');
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Feedback error:', error);
    return null;
  }
}
function getSeverityText(severity) {
  switch(severity) {
    case 1: return 'Minor';
    case 2: return 'Error';
    case 3: return 'Critical';
    default: return 'Error';
  }
}

function getSeverityColor(severity) {
  switch(severity) {
    case 1: return '#4caf50'; // Green - Minor
    case 2: return '#ff9800'; // Orange - Error
    case 3: return '#f44336'; // Red - Critical
    default: return '#ff9800';
  }
}

function displayFeedbackResults(feedback) {
  if (!feedback) {
    alert('Error getting feedback. Please try again.');
    return;
  }

  // Display corrected version
  const correctedDiv = document.querySelector('#corrected-version .feedback-content');
  if (feedback.is_correct) {
    correctedDiv.innerHTML = '<span style="color: #4caf50; font-weight: 600;">🎉 Perfect! No Mistakes Found</span>';
  } else {
    correctedDiv.textContent = feedback.corrected_version || 'No corrections available.';
  }

  // Display natural version with explanation
  const naturalDiv = document.querySelector('#natural-version .feedback-content');
  if (feedback.natural_version && typeof feedback.natural_version === 'object') {
    const naturalText = feedback.natural_version.text || 'No natural version available.';
    const explanation = feedback.natural_version.explanation || '';
    
    if (naturalText === 'Already Natural') {
      naturalDiv.innerHTML = `<span style="color: #4caf50; font-weight: 600;">🎉 Already Natural</span><br><small style="color: #888; margin-top: 4px; display: block;">${explanation}</small>`;
    } else {
      naturalDiv.innerHTML = `<div style="color: #4a9eff; margin-bottom: 6px;">${naturalText}</div><small style="color: #888;">💡 ${explanation}</small>`;
    }
  } else {
    naturalDiv.textContent = feedback.natural_version || 'No natural version available.';
  }

  // Display mistakes and grammar with 3-level severity
  const mistakesDiv = document.querySelector('#mistakes-explanation .feedback-content');
  if (feedback.mistakes && feedback.mistakes.length > 0) {
    const mistakesList = feedback.mistakes.map(mistake => {
      const severityStars = '⭐'.repeat(mistake.severity || 2);
      const severityText = getSeverityText(mistake.severity || 2);
      
      return `<div style="margin-bottom: 16px; padding: 12px; background: #1a1c1d; border-radius: 8px; border-left: 4px solid ${getSeverityColor(mistake.severity || 2)};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: #ff6b6b;">❌ ${mistake.error}</strong>
          <span style="color: #ffd93d; font-size: 0.8rem;">${severityStars} ${severityText}</span>
        </div>
        <div style="color: #4a9eff; margin-bottom: 6px;">✅ ${mistake.correction}</div>
        <small style="color: #888;">📚 ${mistake.grammar_concept}</small>
      </div>`;
    }).join('');
    mistakesDiv.innerHTML = mistakesList;
  } else {
    mistakesDiv.innerHTML = '<span style="color: #4caf50; font-weight: 600;">🎉 Perfect! No mistakes found.</span>';
  }

  // Display learning progress (only if there are mistakes)
  const learningDiv = document.querySelector('#learning-progress .feedback-content');
  if (feedback.learned_concepts && feedback.learned_concepts.length > 0) {
    const conceptsList = feedback.learned_concepts.map(concept => 
      `<span style="display: inline-block; background: #4a9eff; color: white; padding: 6px 10px; border-radius: 12px; margin: 3px; font-size: 0.85rem; font-weight: 500;">🎯 ${concept}</span>`
    ).join('');
    learningDiv.innerHTML = `<div style="margin-bottom: 10px; font-weight: 600; color: #f1f1f1;">Topics to practice:</div>${conceptsList}`;
  } else {
    learningDiv.innerHTML = '<span style="color: #4caf50; font-weight: 600;">🎉 No mistakes made - great job!</span>';
  }
}

function initializeFeedbackPage() {
  const feedbackBtn = document.getElementById('btn-get-feedback');
  const writingInput = document.getElementById('writing-input');

  // Populate textarea with selected text from storage
  chrome.storage.local.get("selectedText", ({ selectedText }) => {
    if (selectedText) {
      writingInput.value = selectedText;
    }
  });

  feedbackBtn.addEventListener('click', async () => {
    const text = writingInput.value.trim();

    if (!text) {
      alert('Please enter some text to get feedback.');
      return;
    }

    // Show loading state
    feedbackBtn.textContent = '🔄 Analyzing...';
    feedbackBtn.disabled = true;

    try {
      const feedback = await getWritingFeedback(text);
      displayFeedbackResults(feedback);
    } catch (error) {
      console.error('Feedback error:', error);
      alert('Error getting feedback. Please try again.');
    } finally {
      // Reset button
      feedbackBtn.innerHTML = '<span>🔍</span> Get Feedback';
      feedbackBtn.disabled = false;
    }
  });
}

async function fetchTranslation(text, source = "auto", target = "es") {
  const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.responseData.translatedText;
  } catch (err) {
    console.error("Translation error:", err);
    return null;
  }
}

async function fetchExplanation(text, lang) {
  // Try a simpler approach first
  try {
    console.log("Fetching explanation for:", text, "in", lang);
    
    // Use a free dictionary API as primary source
    const dictionaryUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(text)}`;
    const res = await fetch(dictionaryUrl);
    
    if (res.ok) {
      const data = await res.json();
      if (data[0] && data[0].meanings && data[0].meanings[0]) {
        return data[0].meanings[0].definitions[0].definition;
      }
    }
    
    // If dictionary API fails, try GitHub AI
    if (!GITHUB_TOKEN) {
      return "API token not available. Please add your GitHub token to secrets.js file.";
    }

    const url = "https://models.github.ai/inference/chat/completions";
    const isPhrase = text.trim().split(/\s+/).length > 1;

    const prompt = isPhrase
      ? `In ${lang}, analyze the phrase: "${text}". 
        If it is a famous phrase, idiom, lyric, movie quote, or cultural reference, briefly explain its meaning and cultural context (author, context, etc). Use 10-20 words.
        If it is not, give a short dictionary-style definition only.
        Respond with just the meaning.
        Do not include the phrase as the key of a dictionary in your response. 
        Do not mention whether it is famous or not. 
        Respond in one sentence. Do not use quotation marks.`
      : `Define the word ${text} in ${lang}. 
        Give a short dictionary-style definition only, without explanation or commentary.
        Respond with just the meaning. 
        Do not include the word as the key of a dictionary in your response. 
        Do not use quotation marks. Keep it under 10 words.`;

    const aiRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 80,
      }),
    });

    console.log("AI Response status:", aiRes.status);

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error("AI API Error Response:", errorText);
      throw new Error(`HTTP ${aiRes.status}: ${errorText}`);
    }

    const aiData = await aiRes.json();
    console.log("AI API Response data:", aiData);
    
    if (aiData.choices && aiData.choices[0]?.message?.content) {
      return aiData.choices[0].message.content.trim();
    }
    
    return "No explanation available.";
  } catch (err) {
    console.error("Explanation API error:", err);
    return "Error retrieving explanation.";
  }
}

async function fetchSynonyms(text, lang) {
  const url = "https://models.github.ai/inference/chat/completions";
  const isPhrase = text.trim().split(/\s+/).length > 1;

  const systemPrompt = `You are a language learning assistant. You must respond with EXACTLY the format requested. Do not add any explanations, commentary, or additional formatting. Only return the requested format.`;

  const userPrompt = isPhrase
    ? `List 10 similar phrases or alternative expressions in ${lang} for "${text}". 

Return ONLY this exact format (no quotes, no extra text):
Formal: [phrase], Informal: [phrase], More Intense: [phrase], Less Intense: [phrase], Idiomatic: [phrase], Different Subject: [phrase], Different Verb: [phrase], Different Object: [phrase], Variation 1: [phrase], Variation 2: [phrase]

Rules:
- Use exactly the labels shown above
- Separate each item with ", " (comma space)
- Do not use quotation marks around phrases
- Do not add explanations or commentary
- Do not add line breaks or extra formatting
- For 'Idiomatic', use a well-known idiom or phrasal verb
- For Different Subject, Different Verb, Different Object, just change the subject, verb, or object, respectively, while holding the other sentence components the same`
    : `List 10 variations of the word "${text}" in ${lang}. 

Return ONLY this exact format (no quotes, no extra text):
Formal: [word], Informal: [word], More Intense: [word], Less Intense: [word], Idiomatic: [expression], Other: [word], Other: [word], Other: [word], Other: [word], Other: [word]

Rules:
- Use exactly the labels shown above
- Separate each item with ", " (comma space)
- Do not use quotation marks around words
- Do not add explanations or commentary
- Do not add line breaks or extra formatting
- For 'Idiomatic', use a famous or widely used idiom or phrasal expression`;

  try {
    // Check if token is available
    if (!GITHUB_TOKEN) {
      return "API token not available. Please add your GitHub token to secrets.js file.";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1, // Lower temperature for more consistent formatting
        max_tokens: 200,
      }),
    });

    const data = await res.json();
    if (data.choices && data.choices[0]?.message?.content) {
      const response = data.choices[0].message.content.trim();
      console.log("AI Synonyms Response:", response); // Debug log
      return response;
    }
    return "No synonyms found.";
  } catch (err) {
    console.error("API error:", err);
    return "Error retrieving synonyms.";
  }
}

async function fetchExamples(text, lang) {
  const url = "https://models.github.ai/inference/chat/completions";

  const prompt = `Provide exactly three example sentences in ${lang} that use the exact phrase "${text}". Each sentence should be 5-15 words maximum. The phrase "${text}" must appear exactly as written in each sentence. Separate each example with a newline character. Do not use quotation marks around the examples. Keep sentences simple and clear.`;

  try {
    // Check if token is available
    if (!GITHUB_TOKEN) {
      return "API token not available. Please add your GitHub token to secrets.js file.";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 120,
      }),
    });

    const data = await res.json();
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content.trim();
    }
    return "No examples found.";
  } catch (err) {
    console.error("API error:", err);
    return "Error retrieving examples.";
  }
}

function fetchPronunciationTTS(text, lang = "en") {
  const encoded = encodeURIComponent(text.trim());
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function formatAsBulletList(text, separator = ",") {
  if (!text || text === "No synonyms found." || text === "No examples found." || text === "Error retrieving synonyms." || text === "Error retrieving examples.") {
    return escapeHTML(text);
  }
  
  // Clean up the text - remove quotes and extra whitespace
  let cleanedText = text.replace(/["""]/g, '').trim();
  
  // Split by separator and clean up
  const items = cleanedText.split(separator)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  if (items.length === 0) {
    return escapeHTML(text);
  }
  
  // Create HTML bullet list
  const bulletList = items.map(item => `<li>${escapeHTML(item)}</li>`).join('');
  return `<ul style="margin: 5px 0; padding-left: 20px;">${bulletList}</ul>`;
}

function formatAsChips(text, separator = ",") {
  if (!text || text === "No synonyms found." || text === "No examples found." || text === "Error retrieving synonyms." || text === "Error retrieving examples.") {
    return escapeHTML(text);
  }
  
  // Clean up the text - remove quotes and extra whitespace
  let cleanedText = text.replace(/["""]/g, '').trim();
  
  // Split by separator and clean up
  const items = cleanedText.split(separator)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  if (items.length === 0) {
    return escapeHTML(text);
  }
  
  // Create chip-style tags
  const chips = items.map(item => 
    `<span class="chip">${escapeHTML(item)}</span>`
  ).join('');
  
  return `<div class="chips-container">${chips}</div>`;
}

function formatAsLabeledChips(text) {
  if (!text || text === "No synonyms found." || text === "Error retrieving synonyms.") {
    return escapeHTML(text);
  }
  
  console.log("formatAsLabeledChips input:", text); // Debug log
  
  // Clean up the text - remove quotes and extra whitespace
  let cleanedText = text.replace(/["""]/g, '').trim();
  
  console.log("formatAsLabeledChips cleaned:", cleanedText); // Debug log
  
  // Try multiple parsing strategies to handle different AI model formats
  
  // Strategy 1: Parse comma-separated format (original expected format)
  let pairs = parseCommaSeparatedFormat(cleanedText);
  console.log("Strategy 1 (comma) results:", pairs); // Debug log
  
  // Strategy 2: If Strategy 1 fails, try parsing newline-separated format
  if (pairs.length === 0) {
    pairs = parseNewlineSeparatedFormat(cleanedText);
    console.log("Strategy 2 (newline) results:", pairs); // Debug log
  }
  
  // Strategy 3: If Strategy 2 fails, try parsing with different separators
  if (pairs.length === 0) {
    pairs = parseFlexibleFormat(cleanedText);
    console.log("Strategy 3 (flexible) results:", pairs); // Debug log
  }
  
  // Strategy 4: If all parsing fails, try to extract any labeled content
  if (pairs.length === 0) {
    pairs = parseAnyLabeledFormat(cleanedText);
    console.log("Strategy 4 (any labeled) results:", pairs); // Debug log
  }
  
  // Strategy 5: Final fallback for completely unexpected formats
  if (pairs.length === 0) {
    pairs = parseFallbackFormat(cleanedText);
    console.log("Strategy 5 (fallback) results:", pairs); // Debug log
  }
  
  if (pairs.length === 0) {
    console.log("All parsing strategies failed, falling back to simple chips"); // Debug log
    // If no labeled format found, fall back to simple chip format
    return formatAsChips(cleanedText, ",");
  }
  
  console.log("Final parsed pairs:", pairs); // Debug log
  
  // Create labeled chip-style tags
  const chips = pairs.map(pair => 
    `<span class="labeled-chip">
      <span class="chip-label">${escapeHTML(pair.label)}</span>
      <span class="chip-value">${escapeHTML(pair.value)}</span>
    </span>`
  ).join('');
  
  return `<div class="labeled-chips-container">${chips}</div>`;
}

function formatAsCards(text, separator = ",") {
  if (!text || text === "No synonyms found." || text === "No examples found." || text === "Error retrieving synonyms." || text === "Error retrieving examples.") {
    return escapeHTML(text);
  }
  
  // Clean up the text - remove quotes and extra whitespace
  let cleanedText = text.replace(/["""]/g, '').trim();
  
  // Split by separator and clean up
  const items = cleanedText.split(separator)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  if (items.length === 0) {
    return escapeHTML(text);
  }
  
  // Create card-style items
  const cards = items.map(item => 
    `<div class="item-card">${escapeHTML(item)}</div>`
  ).join('');
  
  return `<div class="cards-container">${cards}</div>`;
}

function formatAsHighlightedText(text) {
  if (!text || text === "No definition available." || text === "Error retrieving explanation.") {
    return escapeHTML(text);
  }
  
  // Clean up the text - remove quotes and extra whitespace
  let cleanedText = text.replace(/["""]/g, '').trim();
  
  return `<span class="highlighted-text">${escapeHTML(cleanedText)}</span>`;
}

function formatAsTranslation(text, targetLang) {
  if (!text) {
    return escapeHTML("Translation not available.");
  }
  
  return `<span class="translation-text">${escapeHTML(text)}</span>`;
}

function formatAsAudioPlayer(audioUrl) {
  const audioId = 'audio-' + Math.random().toString(36).substr(2, 9);
  const btnId = 'btn-' + Math.random().toString(36).substr(2, 9);
  return `
    <div class="audio-container">
      <div class="custom-audio-player">
        <button class="audio-play-btn" id="${btnId}" data-audio="${audioId}">
          <span class="play-icon">▶</span>
        </button>
        <div class="audio-info">
          <span class="audio-text">Click to hear pronunciation</span>
          <div class="audio-progress">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
        </div>
      </div>
      <audio id="${audioId}" preload="none">
        <source src="${audioUrl}" type="audio/mpeg">
      </audio>
    </div>
  `;
}

// Helper function to parse comma-separated format
function parseCommaSeparatedFormat(text) {
  const pairs = text.split(', ').map(pair => {
    const colonIndex = pair.indexOf(': ');
    if (colonIndex === -1) return null;
    const label = pair.substring(0, colonIndex).trim();
    const value = pair.substring(colonIndex + 2).trim();
    return { label, value };
  }).filter(pair => pair !== null && pair.label && pair.value);
  
  return pairs;
}

// Helper function to parse newline-separated format
function parseNewlineSeparatedFormat(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const pairs = lines.map(line => {
    const colonIndex = line.indexOf(': ');
    if (colonIndex === -1) return null;
    const label = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 2).trim();
    return { label, value };
  }).filter(pair => pair !== null && pair.label && pair.value);
  
  return pairs;
}

// Helper function to parse flexible format with various separators
function parseFlexibleFormat(text) {
  // Try different separators: semicolon, period, or any combination
  const separators = ['; ', '. ', ' | ', ' - ', '\n'];
  
  for (const separator of separators) {
    const parts = text.split(separator).map(part => part.trim()).filter(part => part.length > 0);
    const pairs = parts.map(part => {
      const colonIndex = part.indexOf(': ');
      if (colonIndex === -1) return null;
      const label = part.substring(0, colonIndex).trim();
      const value = part.substring(colonIndex + 2).trim();
      return { label, value };
    }).filter(pair => pair !== null && pair.label && pair.value);
    
    if (pairs.length > 0) {
      return pairs;
    }
  }
  
  return [];
}

// Helper function to extract any labeled content from the text
function parseAnyLabeledFormat(text) {
  // Look for any pattern that has "Label: value" format
  const labeledPattern = /([A-Za-z\s]+):\s*([^,\n]+)/g;
  const pairs = [];
  let match;
  
  while ((match = labeledPattern.exec(text)) !== null) {
    const label = match[1].trim();
    const value = match[2].trim();
    if (label && value) {
      pairs.push({ label, value });
    }
  }
  
  return pairs;
}

// Final fallback function for completely unexpected formats
function parseFallbackFormat(text) {
  // If the text contains any colons, try to extract them as labeled content
  if (text.includes(':')) {
    return parseAnyLabeledFormat(text);
  }
  
  // If no colons found, try to split by common separators and create generic labels
  const separators = [', ', '; ', '. ', '\n', ' | ', ' - '];
  
  for (const separator of separators) {
    const parts = text.split(separator).map(part => part.trim()).filter(part => part.length > 0);
    if (parts.length > 1) {
      const labels = ['Formal', 'Informal', 'More Intense', 'Less Intense', 'Idiomatic', 'Different Subject', 'Different Verb', 'Different Object', 'Variation 1', 'Variation 2'];
      const pairs = parts.slice(0, Math.min(parts.length, labels.length)).map((part, index) => ({
        label: labels[index] || `Option ${index + 1}`,
        value: part
      }));
      return pairs;
    }
  }
  
  return [];
}

// Attach audio player event listeners after rendering
function attachAudioPlayerListeners() {
  // Pause any playing audio before starting a new one
  let lastAudio = null;
  let lastBtn = null;

  document.querySelectorAll('.audio-play-btn').forEach(btn => {
    const audioId = btn.getAttribute('data-audio');
    const audio = document.getElementById(audioId);
    const playIcon = btn.querySelector('.play-icon');
    const progressFill = btn.parentElement.querySelector('.progress-fill');

    // Remove previous listeners to avoid stacking
    btn.onclick = null;
    if (audio) {
      audio.onended = null;
      audio.ontimeupdate = null;
    }

    btn.addEventListener('click', () => {
      // Pause any other audio
      if (lastAudio && lastAudio !== audio) {
        lastAudio.pause();
        if (lastBtn) {
          lastBtn.classList.remove('playing');
          lastBtn.querySelector('.play-icon').textContent = '▶';
        }
      }
      lastAudio = audio;
      lastBtn = btn;

      if (audio.paused) {
        audio.play().then(() => {
          playIcon.textContent = '⏸';
          btn.classList.add('playing');
        }).catch(error => {
          console.error('Audio playback failed:', error);
        });
      } else {
        audio.pause();
        playIcon.textContent = '▶';
        btn.classList.remove('playing');
      }
    });

    if (audio) {
      audio.addEventListener('ended', () => {
        playIcon.textContent = '▶';
        btn.classList.remove('playing');
        progressFill.style.width = '0%';
      });
      audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = progress + '%';
      });
    }
  });
}

function createResultSection(title, content, icon = "") {
  return `
    <div class="result-section">
      <div class="result-header">
        ${icon ? `<span class="result-icon">${icon}</span>` : ''}
        <h3 class="result-title">${title}</h3>
      </div>
      <div class="result-content">
        ${content}
      </div>
    </div>
  `;
}

// Unified language list with codes and names
const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" }
];

// Derived data for convenience:
const generalLanguages = languages.map(l => l.name);
const langNameToCode = Object.fromEntries(languages.map(l => [l.name, l.code]));

// For translation target, exclude English (or adjust as needed)
const translationLanguages = languages;

function populateSelect(selectId, items, isCodeName = false, defaultValue = null) {
  const select = document.getElementById(selectId);
  select.innerHTML = ""; // Clear existing options
  items.forEach(item => {
    const option = document.createElement("option");
    if (isCodeName) {
      option.value = item.code;
      option.textContent = item.name;
      if (defaultValue && item.code === defaultValue) option.selected = true;
    } else {
      option.value = item;
      option.textContent = item;
      if (defaultValue && item === defaultValue) option.selected = true;
    }
    select.appendChild(option);
  });
}

// Helper to get language code from name
function getLangCode(name) {
  return langNameToCode[name] ? langNameToCode[name].toUpperCase() : name.toUpperCase();
}

// Helper to update a section by name (already present)
async function updateSection(sectionName, text) {
  const generalLangSelector = document.getElementById("general-language");
  const translationLangSelector = document.getElementById("translation-language");
  const targetLang = translationLangSelector.value;
  const generalLang = generalLangSelector.value;

  let content = "";
  let icon = "";
  let title = "";

  switch (sectionName) {
    case "translation":
      const translation = await fetchTranslation(text, "en", targetLang);
      content = formatAsTranslation(translation, targetLang);
      icon = "🈯";
      title = `Translation (${targetLang.toUpperCase()})`;
      break;
    case "explanation":
      const explanation = await fetchExplanation(text, generalLang);
      content = formatAsHighlightedText(explanation);
      icon = "📖";
      title = `Explanation (${getLangCode(generalLang)})`;
      break;
    case "synonyms":
      const synonyms = await fetchSynonyms(text, generalLang);
      content = formatAsLabeledChips(synonyms);
      icon = "🔁";
      title = `Similar Words & Phrases (${getLangCode(generalLang)})`;
      break;
    case "examples":
      const examples = await fetchExamples(text, generalLang);
      content = formatAsCards(examples, "\n");
      icon = "✍️";
      title = `Usage Examples (${getLangCode(generalLang)})`;
      break;
    case "pronunciation":
      const pronunciationUrl = fetchPronunciationTTS(text, langNameToCode[generalLang] || "en");
      content = formatAsAudioPlayer(pronunciationUrl);
      icon = "🔊";
      title = `Pronunciation (${getLangCode(generalLang)})`;
      break;
  }

  const sectionDiv = document.getElementById(`${sectionName}-result`);
  if (sectionDiv) {
    sectionDiv.innerHTML = createResultSection(
      title,
      content,
      icon
    );
    attachAudioPlayerListeners(); // Attach listeners after results are loaded
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize navigation and feedback functionality
  initializeNavigation();
  initializeFeedbackPage();
  
  populateSelect("general-language", generalLanguages, false, "English");
  populateSelect("translation-language", translationLanguages, true, "es");

  chrome.storage.local.get("selectedText", async ({ selectedText }) => {
    if (!selectedText) {
      document.getElementById("results").innerHTML =
        "<p>Select a word or phrase, right-click, and choose 'Check Language Info'.</p>";
      return;
    }

    document.getElementById("selected-text").textContent = selectedText;
    const lastSelectedText = selectedText; // Store for updateSection

    const generalLangSelector = document.getElementById("general-language");
    const translationLangSelector = document.getElementById("translation-language");

    // All button: fetch everything using respective language selectors
    document.getElementById("btn-all").onclick = async () => {
      // Clear all result divs
      document.getElementById("translation-result").innerHTML = "";
      document.getElementById("explanation-result").innerHTML = "";
      document.getElementById("synonyms-result").innerHTML = "";
      document.getElementById("examples-result").innerHTML = "";
      document.getElementById("pronunciation-result").innerHTML = "";
      
      // Show loading message
      document.getElementById("results").insertAdjacentHTML("afterbegin", '<p class="loading-message">🔄 Loading all results...</p>');

      const targetLang = translationLangSelector.value;
      const generalLang = generalLangSelector.value;

      const [translation, explanation, synonyms, examples] = await Promise.all([
        fetchTranslation(selectedText, "en", targetLang),
        fetchExplanation(selectedText, generalLang),
        fetchSynonyms(selectedText, generalLang),
        fetchExamples(selectedText, generalLang),
      ]);

      const pronunciationUrl = fetchPronunciationTTS(selectedText, langNameToCode[generalLang] || "en");

      // Remove loading message
      const loadingMessage = document.querySelector("#results p");
      if (loadingMessage) {
        loadingMessage.remove();
      }

      // Populate each result div individually with coherent formatting
      document.getElementById("translation-result").innerHTML = createResultSection(
        `Translation (${targetLang.toUpperCase()})`,
        formatAsTranslation(translation, targetLang),
        "🈯"
      );
      
      document.getElementById("explanation-result").innerHTML = createResultSection(
        `Explanation (${getLangCode(generalLang)})`,
        formatAsHighlightedText(explanation),
        "📖"
      );
      
      document.getElementById("synonyms-result").innerHTML = createResultSection(
        `Similar Words & Phrases (${getLangCode(generalLang)})`,
        formatAsLabeledChips(synonyms),
        "🔁"
      );
      
      document.getElementById("examples-result").innerHTML = createResultSection(
        `Usage Examples (${getLangCode(generalLang)})`,
        formatAsCards(examples, "\n"),
        "✍️"
      );
      
      document.getElementById("pronunciation-result").innerHTML = createResultSection(
        `Pronunciation (${getLangCode(generalLang)})`,
        formatAsAudioPlayer(pronunciationUrl),
        "🔊"
      );
      attachAudioPlayerListeners(); // Attach listeners after results are loaded
    };

    // Translation button only: use translation language
    document.getElementById("btn-translate").onclick = async () => {
      const lang = translationLangSelector.value;
      const translation = await fetchTranslation(selectedText, "en", lang);
      document.getElementById("translation-result").innerHTML = createResultSection(
        `Translation (${lang.toUpperCase()})`,
        formatAsTranslation(translation, lang),
        "🈯"
      );
    };

    // Explanation button: use general info language
    document.getElementById("btn-explain").onclick = async () => {
      const lang = generalLangSelector.value;
      const explanation = await fetchExplanation(selectedText, lang);
      document.getElementById("explanation-result").innerHTML = createResultSection(
        "Explanation",
        formatAsHighlightedText(explanation),
        "📖"
      );
    };

    // Synonyms button: use general info language
    document.getElementById("btn-synonyms").onclick = async () => {
      const lang = generalLangSelector.value;
      const synonyms = await fetchSynonyms(selectedText, lang);
      document.getElementById("synonyms-result").innerHTML = createResultSection(
        `Similar Words & Phrases (${getLangCode(lang)})`,
        formatAsLabeledChips(synonyms),
        "🔁"
      );
    };

    // Examples button: use general info language
    document.getElementById("btn-examples").onclick = async () => {
      const lang = generalLangSelector.value;
      const examples = await fetchExamples(selectedText, lang);
      document.getElementById("examples-result").innerHTML = createResultSection(
        "Usage Examples",
        formatAsCards(examples, "\n"),
        "✍️"
      );
    };

    // Pronunciation button: use general info language (or fallback)
    document.getElementById("btn-pronunciation").onclick = async () => {
      const lang = generalLangSelector.value || "en";
      const pronunciationUrl = fetchPronunciationTTS(selectedText, langNameToCode[lang] || "en");
      document.getElementById("pronunciation-result").innerHTML = createResultSection(
        "Pronunciation",
        formatAsAudioPlayer(pronunciationUrl),
        "🔊"
      );
      attachAudioPlayerListeners(); // Attach listeners after results are loaded
    };

    // On dropdown change, update only visible (non-empty) sections
    // [generalLangSelector, translationLangSelector].forEach(sel => {
    //   sel.addEventListener('change', async () => {
    //     const sectionMap = {
    //       'translation-result': 'translation',
    //       'explanation-result': 'explanation',
    //       'synonyms-result': 'synonyms',
    //       'examples-result': 'examples',
    //       'pronunciation-result': 'pronunciation',
    //     };
    //     for (const [divId, section] of Object.entries(sectionMap)) {
    //       const el = document.getElementById(divId);
    //       if (el && el.innerHTML.trim() !== '') {
    //         await updateSection(section, lastSelectedText);
    //       }
    //     }
    //   });
    // });

    // New: Separate handlers for each selector
    generalLangSelector.addEventListener('change', async () => {
      const sections = ['explanation', 'synonyms', 'examples', 'pronunciation'];
      for (const section of sections) {
        const el = document.getElementById(`${section}-result`);
        if (el && el.innerHTML.trim() !== '') {
          await updateSection(section, lastSelectedText);
        }
      }
    });

    translationLangSelector.addEventListener('change', async () => {
      const el = document.getElementById('translation-result');
      if (el && el.innerHTML.trim() !== '') {
        await updateSection('translation', lastSelectedText);
      }
    });

    chrome.storage.local.remove("selectedText");
  });
});

// Test function to debug parsing issues
function testParsing(responseText) {
  console.log("=== Testing Parsing ===");
  console.log("Input:", responseText);
  
  const result = formatAsLabeledChips(responseText);
  console.log("Output HTML:", result);
  
  return result;
}

// Example usage:
// testParsing("Formal: hello, Informal: hi, More Intense: HELLO");
// testParsing("Formal: hello\nInformal: hi\nMore Intense: HELLO");
// testParsing("hello, hi, HELLO"); // Should fall back to simple chips
