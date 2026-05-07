const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const admin = require('firebase-admin');
const axios = require('axios');
const scamDatabase = require('./scam_database');

dotenv.config();

// Load Firebase credentials — base64-encoded JSON takes priority (most reliable for production)
let serviceAccount;
if (process.env.FIREBASE_CREDENTIALS_BASE64) {
  serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_CREDENTIALS_BASE64, 'base64').toString('utf8'));
} else {
  serviceAccount = require('../firebaseKey.json');
}

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini (used for message scanning + translation)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, { apiVersion: 'v1beta' });
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });

// Retry wrapper — tries 2.5 flash first, falls back to 2.0 flash on 503/500
async function geminiGenerateWithRetry(promptOrParts, maxAttempts = 1) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await model.generateContent(promptOrParts);
      return result;
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      const isTransient = status === 500 || status === 503 || err.message?.includes('Internal error') || err.message?.includes('high demand');
      if (isTransient && attempt < maxAttempts) {
        const delay = 1000 * attempt;
        console.warn(`[Gemini] Attempt ${attempt} failed (${status ?? err.message}), retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}


// OpenAI GPT-4o mini (link + image scanning) — only initialize if key is present
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Helper: strip markdown and extract JSON from AI response
const parseOpenAIJson = (text) => {
  const match = text.replace(/```json\n?/g, '').replace(/```/g, '').trim().match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Could not parse AI response');
};

const serverTranslations = {
  en: {
    legitimate: 'This is a legitimate message from {type}. It appears to be safe.',
    officialLink: 'This is an official {type} link. It is safe to visit.',
    verified: 'This message is verified as legitimate',
    proceed: 'You can proceed with confidence',
    officialChannels: 'Always verify important transactions through official channels',
    verifiedLink: 'This is a verified official link',
    safelyClick: 'You can safely click this link',
    checkDomain: 'Always ensure the domain matches official sources',
    imageFailed: 'Could not reliably analyze the image. Please use caution.',
    noClick: 'Do not click any links',
    verifyIndependently: 'Verify independently',
    scamDetected: 'This link has been flagged by multiple scam detection systems. Do not proceed.',
    reportScam: 'Report this link to CCID (www.ccid.rmp.gov.my) or call 997.'
  },
  ms: {
    legitimate: 'Ini adalah mesej yang sah daripada {type}. Ia kelihatan selamat.',
    officialLink: 'Ini adalah pautan rasmi {type}. Ia selamat untuk dilawati.',
    verified: 'Mesej ini disahkan sebagai sah',
    proceed: 'Anda boleh meneruskan dengan yakin',
    officialChannels: 'Sentiasa sahkan transaksi penting melalui saluran rasmi',
    verifiedLink: 'Ini adalah pautan rasmi yang disahkan',
    safelyClick: 'Anda boleh klik pautan ini dengan selamat',
    checkDomain: 'Sentiasa pastikan domain sepadan dengan sumber rasmi',
    imageFailed: 'Tidak dapat menganalisis imej dengan tepat. Sila berhati-hati.',
    noClick: 'Jangan klik mana-mana pautan',
    verifyIndependently: 'Sahkan secara bebas',
    scamDetected: 'Pautan ini telah ditandakan oleh pelbagai sistem pengesanan penipuan. Jangan teruskan.',
    reportScam: 'Laporkan pautan ini kepada CCID (www.ccid.rmp.gov.my) atau hubungi 997.'
  },
  zh: {
    legitimate: '这是来自 {type} 的合法信息。看起来是安全的。',
    officialLink: '这是 {type} 的官方链接。访问是安全的。',
    verified: '此信息已验证为合法',
    proceed: '您可以放心继续',
    officialChannels: '始终通过官方渠道核实重要交易',
    verifiedLink: '这是经过验证的官方链接',
    safelyClick: '您可以安全地点击此链接',
    checkDomain: '始终确保域名与官方来源匹配',
    imageFailed: '无法可靠地分析图像。请谨慎操作。',
    noClick: '请勿点击任何链接',
    verifyIndependently: '独立核实',
    scamDetected: '此链接已被多个诈骗检测系统标记。请勿继续。',
    reportScam: '请向CCID举报此链接 (www.ccid.rmp.gov.my) 或拨打997。'
  },
  ta: {
    legitimate: 'இது {type} இலிருந்து வந்த உண்மையான செய்தி. இது பாதுகாப்பானதாகத் தெரிகிறது.',
    officialLink: 'இது {type} இன் அதிகாரப்பூர்வ இணைப்பு. இதைப் பார்வையிடுவது பாதுகாப்பானது.',
    verified: 'இந்தச் செய்தி உண்மையானது எனச் சரிபார்க்கப்பட்டது',
    proceed: 'நீங்கள் நம்பிக்கையுடன் தொடரலாம்',
    officialChannels: 'முக்கியமான பரிவர்த்தனைகளை எப்போதும் அதிகாரப்பூர்வ சேனல்கள் மூலம் சரிபார்க்கவும்',
    verifiedLink: 'இது சரிபார்க்கப்பட்ட அதிகாரப்பூர்வ இணைப்பு',
    safelyClick: 'இந்த இணைப்பை நீங்கள் பாதுகாப்பாகக் கிளிக் செய்யலாம்',
    checkDomain: 'டொமைன் அதிகாரப்பூர்வ ஆதாரங்களுடன் பொருந்துகிறது என்பதை எப்போதும் உறுதிப்படுத்தவும்',
    imageFailed: 'படத்தை நம்பத்தகுந்த முறையில் ஆய்வு செய்ய முடியவில்லை. தயவுசெய்து எச்சரிக்கையாக இருக்கவும்.',
    noClick: 'எந்த இணைப்புகளையும் கிளிக் செய்ய வேண்டாம்',
    verifyIndependently: 'சுயமாகச் சரிபார்க்கவும்',
    scamDetected: 'இந்த இணைப்பு பல மோசடி கண்டறிதல் அமைப்புகளால் கொடியிடப்பட்டுள்ளது. தொடர வேண்டாம்.',
    reportScam: 'இந்த இணைப்பை CCID க்கு புகாரளிக்கவும் (www.ccid.rmp.gov.my) அல்லது 997 அழைக்கவும்.'
  }
};

const getTranslation = (lang, key, params = {}) => {
  const l = serverTranslations[lang] ? lang : 'en';
  let str = serverTranslations[l][key] || serverTranslations['en'][key];
  Object.keys(params).forEach(p => {
    str = str.replace(`{${p}}`, params[p]);
  });
  return str;
};

// Logging helper
const logAnalysis = (type, content, result) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${type.toUpperCase()} analyzed`);
  console.log(`Risk Level: ${result.riskLevel} | Confidence: ${result.confidence}%`);
};


//  OFFICIAL WHITELIST CHECK 
const checkOfficalWhitelist = (content) => {
  const whitelistItems = scamDatabase.officialWhitelist;

  for (let item of whitelistItems) {
    if (item.pattern.test(content)) {
      console.log(`[Whitelist] Matched: ${item.type}`);
      return {
        isWhitelisted: true,
        type: item.type,
        risk: 'Low'
      };
    }
  }

  return {
    isWhitelisted: false,
    type: null,
    risk: null
  };
};

//  DATABASE LOOKUP 
const checkAgainstDatabase = (content) => {
  const allScams = [
    ...scamDatabase.parcelScams,
    ...scamDatabase.bankScams,
    ...scamDatabase.governmentScams,
    ...scamDatabase.investmentScams,
    ...scamDatabase.romanceScams,
    ...scamDatabase.phishingScams,
    ...scamDatabase.jobScams,
    ...scamDatabase.lotteryScams,
    ...scamDatabase.ecommerceScams,
    ...scamDatabase.gamblingScams,
    ...scamDatabase.healthScams,
    ...scamDatabase.rentalScams,
    ...scamDatabase.travelScams,
  ];

  let matches = [];
  for (let scam of allScams) {
    if (scam.pattern.test(content)) {
      matches.push({
        type: scam.type,
        risk: scam.risk,
        pattern: scam.pattern.source
      });
    }
  }

  return matches;
};

//  DOMAIN REPUTATION CHECK 
const checkDomainReputation = async (url) => {
  try {
    const domainName = new URL(url).hostname;

    // Try to check against abuse database
    try {
      const response = await axios.get(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${domainName}`,
        {
          headers: {
            'Key': process.env.ABUSEIPDB_KEY || 'demo',
            'Accept': 'application/json'
          },
          timeout: 2000
        }
      );

      const abuse = response.data.data;

      return {
        domain: domainName,
        abuseScore: abuse.abuseConfidenceScore || 0,
        isBlacklisted: (abuse.abuseConfidenceScore || 0) > 50,
        reports: abuse.totalReports || 0,
        usageType: abuse.usageType || 'Unknown',
        source: 'AbuseIPDB'
      };
    } catch (apiError) {
      console.log('[Domain Check] AbuseIPDB API unavailable, using local rules');
      throw apiError;
    }
  } catch (error) {
    // Fallback: use local domain rules
    try {
      const domainName = new URL(url).hostname;
      const isFreeDomain = /\.(tk|ml|ga|cf|gq|xyz|info|biz|site)/.test(domainName);
      const isMisspelled = /mayb4nk|cimb.*verify|maybank.*secure|lhdn.*verify|pdrm.*verify/.test(domainName);

      return {
        domain: domainName,
        abuseScore: (isFreeDomain || isMisspelled) ? 80 : 0,
        isBlacklisted: isFreeDomain || isMisspelled,
        reports: 0,
        usageType: 'unknown',
        source: 'LocalRules'
      };
    } catch (e) {
      return {
        domain: 'unknown',
        abuseScore: 0,
        isBlacklisted: false,
        reports: 0,
        usageType: 'unknown',
        source: 'Error'
      };
    }
  }
};

//  PHONE NUMBER VALIDATOR 
const validateMalaysianPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return { isValid: false, type: 'None', normalized: '' };

  const patterns = {
    mobile: /^(\+6|0)?01[0-9]{8,9}$/,
    fixed: /^(\+60|0)[2-9]\d{7,8}$/,
    toll: /^1300.*|^1800.*|^1900.*/
  };

  const normalized = phoneNumber.replace(/\s|-|\(|\)/g, '');

  return {
    isValid: patterns.mobile.test(normalized) || patterns.fixed.test(normalized) || patterns.toll.test(normalized),
    type: patterns.mobile.test(normalized) ? 'Mobile' : patterns.fixed.test(normalized) ? 'Fixed' : patterns.toll.test(normalized) ? 'Toll-free' : 'Invalid',
    normalized: normalized
  };
};

const analyzePhoneNumbers = (message) => {
  const phoneRegex = /(?:\+60|0)?1[0-9]{8,9}|(?:\+60|0)[2-9]\d{7,8}|1[3-9]00[0-9]{4,7}/g;
  const numbers = message.match(phoneRegex) || [];

  const analysis = numbers.map(num => ({
    number: num,
    validation: validateMalaysianPhoneNumber(num)
  }));

  return analysis;
};


//  BUILT-IN EMOTIONAL MANIPULATION ANALYSIS
const analyzeEmotionalManipulation = (message) => {
  let emotionalScore = 0;
  const triggers = {};

  if (/fear|afraid|panic|emergency|urgent|danger|locked|frozen|suspended|arrested|account.*closed|act.*now|immediately/i.test(message)) {
    emotionalScore += 25;
    triggers.fear = true;
  }

  if (/wow|amazing|incredible|congratulations|won|lucky|jackpot|millionaire|fantastic|easy.*money|free.*money|rich|wealth/i.test(message)) {
    emotionalScore += 20;
    triggers.excitement = true;
  }

  if (/love|miss|care|heart|sweetheart|marry|darling|adore|beloved|sweety/i.test(message)) {
    emotionalScore += 25;
    triggers.love = true;
  }

  if (/hurry|rush|limited|only|final|last.*chance|everyone|friends|all.*getting|don't.*miss|act.*now|before.*too.*late/i.test(message)) {
    emotionalScore += 20;
    triggers.pressure = true;
  }

  if (/help.*me|save.*me|rescue|dying|hospital|accident|surgery|medical|emergency|crisis/i.test(message)) {
    emotionalScore += 15;
    triggers.desperation = true;
  }

  return {
    emotionalScore: Math.min(emotionalScore, 90),
    triggers: triggers,
    isHighRisk: emotionalScore > 40
  };
};

//  ENHANCED RULE-BASED SCORING 
const calculateScamScore = (content, type = 'message') => {
  let score = 0;
  const indicators = {};

  if (type === 'message') {
    // 1. Suspicious Domains (25 points)
    if (/\.(tk|ml|ga|cf|gq|xyz|info|biz|site)\b/i.test(content)) {
      score += 25;
      indicators.suspiciousDomain = true;
    }

    // 2. Misspelled Banks (25 points)
    if (/mayb4nk|cimb.?verify|public.?bank.?secure|hsbc.?confirm|ambank|affin/i.test(content)) {
      score += 25;
      indicators.misspelledBank = true;
    }

    // 3. Urgency Keywords (15 points)
    if (/urgent|immediate|24 hours|within 48|act now|confirm now|verify immediately|do this now|hurry|asap/i.test(content)) {
      score += 15;
      indicators.urgency = true;
    }

    // 4. Payment/OTP Requests (30 points)
    if (/pay|payment|transfer|credit card|otp|password|pin|banking password|confirm card|verify account|click to pay|send money/i.test(content)) {
      score += 30;
      indicators.paymentRequest = true;
    }

    // 5. Government/Bank Impersonation (25 points)
    if (/lhdn|pdrm|bnm|maybank|cimb|public bank|hsbc|dhl|fedex|poslaju|lalamove|grab|affin|ambank/i.test(content)) {
      score += 25;
      indicators.impersonation = true;
    }

    // 6. Reward/Refund Offers (20 points)
    if (/refund|claim refund|tax refund|won|congratulations|prize|reward|cashback|RM\d+|free money|lucky|jackpot/i.test(content)) {
      score += 20;
      indicators.rewardOffer = true;
    }

    // 7. Shortened URLs (20 points)
    if (/bit\.ly|tinyurl|short\.link|goo\.gl|ow\.ly|is\.gd|adf\.ly/i.test(content)) {
      score += 20;
      indicators.shortenedUrl = true;
    }

    // 8. Poor Grammar/Manglish (10 points)
    if (/u r|ur\b|abit|lah|lor|meh|\?{2,}|!{3,}|\.{4,}|plz|pls|plez/i.test(content)) {
      score += 10;
      indicators.poorGrammar = true;
    }

    // 9. Emotional Manipulation (15 points)
    if (/locked|frozen|suspended|arrested|account closed|love you|miss you|i care|don't miss out|everyone getting rich|all my friends/i.test(content)) {
      score += 15;
      indicators.emotionalManipulation = true;
    }

    // 10. Investment Scam Keywords (25 points)
    if (/guaranteed|100% safe|bitcoin|ethereum|forex|cryptocurrency|50% monthly|300% yearly|passive income|downline|referral bonus|mlm|network|direct sales/i.test(content)) {
      score += 25;
      indicators.investmentScam = true;
    }

    // 11. Job Scam Keywords (20 points)
    if (/work from home|easy money|no experience|typing job|form filling|data entry|hiring now|apply now/i.test(content)) {
      score += 20;
      indicators.jobScam = true;
    }

    // 12. Love/Romance Scam (20 points)
    if (/i love you|marry you|send gift|medical emergency|car accident|surgery needed|help me pay/i.test(content)) {
      score += 20;
      indicators.romanceScam = true;
    }

    // 13. Parcel/Delivery Scam (20 points)
    if (/parcel|delivery|package|postage|redelivery|customs|update address|confirm location/i.test(content)) {
      score += 20;
      indicators.parcelScam = true;
    }

    // 14. Phishing Indicators (20 points)
    if (/click here|verify now|confirm immediately|update now|validate account|authenticate/i.test(content)) {
      score += 20;
      indicators.phishing = true;
    }

    // 15. Lottery/Prize (15 points)
    if (/lucky draw|lottery winner|draw winner|you have won|claim prize|processing fee/i.test(content)) {
      score += 15;
      indicators.lotteryScam = true;
    }
  }

  // Determine risk level
  let riskLevel = 'Low';
  let confidence = 75;

  if (score >= 71) {
    riskLevel = 'High';
    confidence = 92 + Math.min(score / 100 * 7, 7);
  } else if (score >= 31) {
    riskLevel = 'Medium';
    confidence = 82 + Math.min(score / 70 * 13, 13);
  } else {
    riskLevel = 'Low';
    confidence = 76 + Math.min(score / 30 * 19, 19);
  }

  confidence = Math.min(Math.round(confidence), 99);

  return {
    score,
    riskLevel,
    confidence,
    indicators
  };
};

// Image OCR and Analysis combined via Gemini Vision
const analyzeImageWithGemini = async (imageBase64, lang = 'en', aiModel = 'auto') => {
  try {
    const mimeMatch = imageBase64.match(/^data:(image\/\w+);base64,/);
    const detectedMime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    let explanationRule = aiModel === 'deep'
      ? 'Detailed visual reasoning using IMPORTANT KEY POINTS only. No nonsense or fluff. Highly informative. (STRICT SYSTEM RULE: NO raw line breaks allow inside strings. Use one single continuous paragraph.)'
      : 'MUST BE EXTREMELY SHORT AND CONCISE (max 1 or 2 small sentences).';

    const prompt = `You are a MALAYSIAN ANTI-FRAUD SPECIALIST. Your task is to analyze whether the following image depicts a scam or fraudulent activity.
    
LANG_PREFERENCE: ${lang} (Provide "explanation" and "advice" in this language. If it is "ta", use Tamil. If "zh", use Chinese. If "ms", use Malay. Otherwise English).

COMMON MALAYSIAN SCAM VISUALS TO DETECT:
- Fake Banking UIs (misspelled headers, incorrect fonts, non-standard buttons).
- Phishing SMS/Email screenshots claiming to be from LHDN, Maybank, Shopee, PostLaju, etc. 
- Content in English, Malay, Chinese (Mandarin/Cantonese), or Tamil (Malaysian Indian context).
- Suspicious URL bars in the screenshot.
- Demands for OTP, PIN, or immediate money transfer.

BANK RECEIPT REFERENCE NUMBER KNOWLEDGE (use to verify legitimacy):
- UPI/Instant transfers: 12-digit Retrieval Reference Number (RRN)
- SWIFT international wire: 16-20 digits
- Malaysian IBG/RENTAS: alphanumeric 8-18 characters
- General bank receipts: 8-18 characters, alphanumeric
- FAKE receipts often have: too short reference (under 8 digits), repeated digits (111111), or no reference number at all

ANALYSIS RULES FOR 99.5% ACCURACY:
1. SCAM (isScam: true) if:
   - It mimics a bank but has slight visual errors.
   - It asks for sensitive credentials (OTP/Password) in a suspicious context.
   - It mentions "Account Blocked" or "Suspicious Login" with an external link.
   - Receipt has missing, too short, or suspicious reference numbers.
   - Receipt amounts/dates look tampered or inconsistent.
2. SAFE (isScam: false) if:
   - It is a clear, official transaction receipt with valid reference number format.
   - Generic screenshots of legitimate apps without suspicious requests.

RESPONSE FORMAT (JSON ONLY):
{
  "isScam": boolean,
  "confidence": number (1-99, reflect genuine certainty — use low values like 40-65 when evidence is weak or mixed),
  "riskLevel": "Low" | "Medium" | "High",
  "scamType": "string (e.g., Fake Bank UI, Phishing SMS, Job Scam)",
  "explanation": "${explanationRule} MANDATORY: WRITE ENTIRELY IN ${lang.toUpperCase()}.",
  "advice": ["Action 1 IN ${lang.toUpperCase()}", "Action 2 IN ${lang.toUpperCase()}", "Action 3 IN ${lang.toUpperCase()}"],
  "extractedText": "All extracted text"
}

CRITICAL: If language is 'ms', output Malay. If 'zh', output Chinese. If 'ta', output Tamil. If 'en', output English. DO NOT USE ANY OTHER LANGUAGE FOR EXPLANATION AND ADVICE.`;

    const result = await geminiGenerateWithRetry([
      { text: prompt },
      { inlineData: { data: base64Data, mimeType: detectedMime } }
    ]);

    const responseText = result.response.text();
    const jsonMatch = responseText.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/```/g, '').trim().match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Could not parse AI response');
  } catch (error) {
    console.error('[Gemini Vision] Error:', error.message);
    return null;
  }
};



//  MESSAGE SCANNING 
app.post('/api/scan-message', async (req, res) => {
  try {
    const { message, lang = 'en' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length < 5) {
      return res.status(400).json({ error: 'Message is too short to analyze' });
    }

    // Whitelist check — collect as signal only, AI still makes final decision
    const whitelistCheck = checkOfficalWhitelist(message);
    if (whitelistCheck.isWhitelisted) {
      console.log(`[Whitelist Signal] ${whitelistCheck.type} — passing to AI for final decision`);
    }

    //  Check against database
    const dbMatches = checkAgainstDatabase(message);
    console.log(`[Database Check] Found ${dbMatches.length} matches`);

    //  Rule-based scoring
    const ruleScore = calculateScamScore(message, 'message');
    console.log(`[Rule-Based Score] ${ruleScore.score} points | ${ruleScore.riskLevel}`);

    //  Analyze phone numbers
    const phoneAnalysis = analyzePhoneNumbers(message);
    console.log(`[Phone Check] Found ${phoneAnalysis.length} phone numbers`);

    const { aiModel } = req.body;
    const embeddedLinkResults = [];
    const hasRiskyLinks = false;

    // Detect embedded links in message (signal only, not scanned)
    const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+/gi;
    const detectedUrls = message.match(urlPattern) || [];
    const hasLinks = detectedUrls.length > 0;
    console.log(`[Link Signal] Found ${detectedUrls.length} links in message`);

    // Detect OTP patterns
    const otpPattern = /\b(?:TAC|OTP|pin|kod|code)\b.*?\b\d{4,8}\b|\b\d{4,8}\b.*?\b(?:TAC|OTP|pin|kod|code)\b/i;
    const hasOtp = otpPattern.test(message);
    console.log(`[OTP Check] OTP detected: ${hasOtp}`);

    // Emotional Manipulation Analysis
    const emotionalAnalysis = analyzeEmotionalManipulation(message);
    console.log(`[Emotion Check] Emotional Risk Score: ${emotionalAnalysis.emotionalScore}`);

    // Route Request & Explanation Rules

    // Auto Mode: smartly selects explanation depth based on content complexity
    const isLongText = message.length > 250;
    const isComplexContent = dbMatches.length > 0 || phoneAnalysis.length > 1 || ruleScore.score > 30 || hasLinks;
    const hasEmotionalRisk = emotionalAnalysis.isHighRisk;
    const needsDeepAnalysis = isLongText || isComplexContent || hasEmotionalRisk;

    let explanationRule;
    let effectiveMode = aiModel || 'auto';

    if (aiModel === 'deep') {
      explanationRule = 'Detailed reasoning using IMPORTANT KEY POINTS only. No nonsense or fluff. Make it longer than normal but highly informative. (STRICT SYSTEM RULE: NO raw line breaks allow inside strings. Use one single continuous paragraph.)';
    } else if (aiModel === 'fast') {
      explanationRule = 'MUST BE EXTREMELY SHORT AND CONCISE (max 1 or 2 small sentences).';
    } else {
      // Auto Mode - smart depth selection
      if (needsDeepAnalysis) {
        explanationRule = 'Detailed reasoning using IMPORTANT KEY POINTS only. No nonsense or fluff. Make it longer than normal but highly informative. (STRICT SYSTEM RULE: NO raw line breaks allow inside strings. Use one single continuous paragraph.)';
        effectiveMode = 'auto→deep';
      } else {
        explanationRule = 'MUST BE EXTREMELY SHORT AND CONCISE (max 1 or 2 small sentences).';
        effectiveMode = 'auto→fast';
      }
    }

    // AI Analysis — deep mode uses a stricter, more thorough prompt
    const prompt = aiModel === 'deep'
      ? `You are a SENIOR Malaysian anti-scam forensic analyst. Perform a DEEP ANALYSIS of this message. Reply entirely in ${lang}.

COLLECTED EVIDENCE:
- Whitelist match: ${whitelistCheck.isWhitelisted ? whitelistCheck.type + ' (NOTE: scammers impersonate official brands — do not trust name alone)' : 'none'}
- Scam patterns matched: ${dbMatches.map(m=>m.type).join(', ')||'none'}
- Phone numbers found: ${phoneAnalysis.length} ${phoneAnalysis.length > 0 ? '— suspicious if user did not request contact' : ''}
- Embedded links detected: ${hasLinks ? detectedUrls.join(', ') : 'none'}
- OTP/TAC present: ${hasOtp ? 'YES — legitimate banks NEVER ask you to share OTP' : 'no'}
- Emotional manipulation triggers: ${Object.keys(emotionalAnalysis.triggers).join(', ')||'none'}
- Rule-based risk score: ${ruleScore.score}/100

MESSAGE TO ANALYZE: "${message}"

DEEP ANALYSIS INSTRUCTIONS:
1. Examine EACH signal above individually — explain if it is suspicious or benign
2. Consider the COMBINATION of signals — multiple weak signals together = high risk
3. Check for impersonation — does sender claim to be a bank, government, or official brand?
4. Check for urgency + action — does message pressure user to click, pay, or share?
5. Re-evaluate confidence strictly — do not be lenient
6. Provide 4-5 specific actionable advice steps

Respond JSON only:
{"isScam":bool,"confidence":1-99,"riskLevel":"Low"|"Medium"|"High","scamType":"string","explanation":"Thorough multi-point analysis covering each signal found, why it is or is not suspicious, and overall verdict. Write as one detailed paragraph in ${lang.toUpperCase()}. NO line breaks inside string.","advice":["step1","step2","step3","step4","step5"]}`
      : `Malaysian anti-scam AI. Analyze this message. Reply in ${lang} only.
Signals:
- Whitelist match: ${whitelistCheck.isWhitelisted ? whitelistCheck.type + ' (looks official but verify context)' : 'none'}
- Scam patterns matched: ${dbMatches.map(m=>m.type).join(',')||'none'}
- Phone numbers found: ${phoneAnalysis.length} ${phoneAnalysis.length > 0 ? '(suspicious if unsolicited)' : ''}
- Embedded links: ${hasLinks ? detectedUrls.join(', ') + ' ⚠️ TREAT AS HIGH RISK if combined with urgency/request' : 'none'}
- OTP/TAC code present: ${hasOtp ? '⚠️ WARNING — legitimate senders never ask you to share OTP' : 'no'}
- Emotional triggers: ${Object.keys(emotionalAnalysis.triggers).join(',')||'none'}
- Rule score: ${ruleScore.score}/100
MESSAGE: "${message}"
RULES: isScam=true if message contains link+urgency, asks to share OTP, impersonates bank/govt, or has suspicious phone. isScam=false if clearly personal or official OTP you requested yourself. Whitelist match alone does NOT mean safe — scammers impersonate official brands.
Respond JSON only:
{"isScam":bool,"confidence":1-99,"riskLevel":"Low"|"Medium"|"High","scamType":"string","explanation":"${explanationRule} IN ${lang.toUpperCase()}","advice":["step1","step2","step3"]}`;


    
    let aiResult;
    try {
      let responseText = '';
      console.log(`[Routing] Using Gemini (Mode: ${effectiveMode})`);
      const result = await geminiGenerateWithRetry(prompt);
      responseText = result.response.text();
      responseText = responseText.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/```/g, '').trim();
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('AI Response Error. Raw output:', responseText);
        throw new Error('Invalid AI response format');
      }
      aiResult = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn('[Message] Gemini failed, trying OpenAI fallback:', e.message);
      try {
        if (!openai) throw new Error('OpenAI not configured');
        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: 350,
          messages: [{ role: 'user', content: prompt }]
        });
        aiResult = parseOpenAIJson(openaiResponse.choices[0].message.content);
      } catch (oe) {
        console.warn('[Message] OpenAI also failed, using rule-based fallback:', oe.message);
        const isScam = dbMatches.length > 0 || ruleScore.score >= 40 || emotionalAnalysis.isHighRisk;
        const confidence = isScam ? Math.min(50 + ruleScore.score, 85) : 75;
        aiResult = {
          isScam,
          confidence,
          riskLevel: ruleScore.score >= 60 ? 'High' : ruleScore.score >= 30 ? 'Medium' : 'Low',
          scamType: dbMatches.length > 0 ? dbMatches[0].type : (isScam ? 'Suspicious Content' : 'No Scam Detected'),
          explanation: isScam
            ? 'This message contains suspicious patterns. AI analysis temporarily unavailable — result based on pattern matching.'
            : 'No obvious scam patterns detected. AI analysis temporarily unavailable.',
          advice: [
            getTranslation(lang, 'noClick'),
            getTranslation(lang, 'reportScam'),
            getTranslation(lang, 'verifyIndependently'),
          ],
          aiUnavailable: true,
        };
      }
    }

    // Combine all scores with SMART logic
    let finalResult = aiResult;

    // If AI says it's NOT a scam, respect that (avoid false positives)
    if (!aiResult.isScam) {
      finalResult.confidence = Math.max(aiResult.confidence, 90);
      finalResult.riskLevel = 'Low';
    } else {
      // Only boost if we have strong evidence
      if (dbMatches.length > 0 && ruleScore.score > 30) {
        finalResult.confidence = Math.max(aiResult.confidence, 96);
        finalResult.isScam = true;
        finalResult.riskLevel = 'High';
        finalResult.databaseMatches = dbMatches;
      }

      if (ruleScore.score > 70) {
        finalResult.confidence = Math.max(finalResult.confidence, 94);
        finalResult.isScam = true;
        finalResult.riskLevel = 'High';
      }

      if (emotionalAnalysis.isHighRisk && ruleScore.score > 20) {
        finalResult.confidence = Math.max(finalResult.confidence, 92);
      }
    }

    // Boost if risky embedded links were found
    if (hasRiskyLinks) {
      finalResult.isScam = true;
      const highRiskLink = embeddedLinkResults.some(l => l.riskLevel === 'High');
      finalResult.riskLevel = highRiskLink ? 'High' : (finalResult.riskLevel === 'Low' ? 'Medium' : finalResult.riskLevel);
      finalResult.confidence = Math.min(Math.max(finalResult.confidence, highRiskLink ? 92 : 85), 99);
    }
    finalResult.embeddedLinks = embeddedLinkResults;

    // Add scoring details
    finalResult.rule_based_score = ruleScore.score;
    finalResult.rule_based_indicators = ruleScore.indicators;
    finalResult.database_matches = dbMatches.length;
    finalResult.phone_analysis = phoneAnalysis;
    finalResult.emotional_analysis = {
      emotionalScore: emotionalAnalysis.emotionalScore,
      triggers: emotionalAnalysis.triggers,
      isHighRisk: emotionalAnalysis.isHighRisk
    };

    logAnalysis('message', message.substring(0, 50), finalResult);

    res.json({
      success: true,
      data: finalResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Message scan error:', error.message);
    res.status(500).json({
      error: 'Failed to analyze message',
      details: error.message
    });
  }
});

//  LINK SCANNING
app.post('/api/scan-link', async (req, res) => {
  try {
    let { url, lang = 'en' } = req.body;

    if (!url || url.trim().length === 0) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Auto-add https:// if user typed a URL without protocol (e.g. "maybank.com.my")
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // CHECK WHITELIST FIRST 
    const whitelistCheck = checkOfficalWhitelist(url);
    if (whitelistCheck.isWhitelisted) {
      console.log(`[Link Whitelist] ${whitelistCheck.type}`);
      return res.json({
        success: true,
        data: {
          isScam: false,
          confidence: 98,
          riskLevel: 'Low',
          scamType: 'Legitimate',
          explanation: getTranslation(lang, 'officialLink', { type: whitelistCheck.type }),
          advice: [
            getTranslation(lang, 'verifiedLink'),
            getTranslation(lang, 'safelyClick'),
            getTranslation(lang, 'checkDomain')
          ],
          whitelistMatch: whitelistCheck.type
        },
        timestamp: new Date().toISOString()
      });
    }

    //  Domain reputation check
    const reputation = await checkDomainReputation(url);
    console.log('[Domain Check]', reputation);

    //  Database check
    const dbMatches = checkAgainstDatabase(url);

    const { aiModel } = req.body;
    // Evaluate early so we can skip the HTML fetch on already-decisive results
    const skipAI = reputation.isBlacklisted && dbMatches.length > 0;

    // Fetch page HTML only when AI will actually use it (saves 0-4s on flagged links)
    let pageContent = '';
    if (!skipAI) {
      try {
        const pageResponse = await axios.get(url, {
          timeout: 4000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScamDetector/1.0)' },
          maxContentLength: 100000,
          validateStatus: (s) => s < 500
        });
        const html = (pageResponse.data || '').toString();
        pageContent = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 1500);
        console.log(`[HTML Fetch] Got ${pageContent.length} chars from ${url}`);
      } catch (e) {
        console.log(`[HTML Fetch] Could not fetch page: ${e.message}`);
      }
    }

    // Auto Mode: smartly selects depth based on link risk signals
    const isRiskyDomain = reputation.isBlacklisted || reputation.abuseScore > 50;
    const hasDbMatches = dbMatches.length > 0;
    const needsDeepLinkAnalysis = isRiskyDomain || hasDbMatches;

    let explanationRule;
    let effectiveMode = aiModel || 'auto';

    if (aiModel === 'deep') {
      explanationRule = 'Detailed domain analysis using IMPORTANT KEY POINTS only. No nonsense or fluff. Highly informative. (STRICT SYSTEM RULE: NO raw line breaks allow inside strings. Use one single continuous paragraph.)';
    } else if (aiModel === 'fast') {
      explanationRule = 'MUST BE EXTREMELY SHORT AND CONCISE (max 1 or 2 small sentences).';
    } else {
      if (needsDeepLinkAnalysis) {
        explanationRule = 'Detailed domain analysis using IMPORTANT KEY POINTS only. No nonsense or fluff. Highly informative. (STRICT SYSTEM RULE: NO raw line breaks allow inside strings. Use one single continuous paragraph.)';
        effectiveMode = 'auto→deep';
      } else {
        explanationRule = 'MUST BE EXTREMELY SHORT AND CONCISE (max 1 or 2 small sentences).';
        effectiveMode = 'auto→fast';
      }
    }

    // AI Link Analysis — deep mode uses stricter forensic prompt
    const prompt = aiModel === 'deep'
      ? `You are a SENIOR Malaysian cybersecurity forensic analyst. Perform DEEP ANALYSIS on this URL. Reply entirely in ${lang}.

FORENSIC EVIDENCE:
- URL: "${url}"
- Domain reputation score: ${JSON.stringify(reputation)}
- Scam database matches: ${dbMatches.length > 0 ? dbMatches.map(m=>m.type).join(', ') : 'none'}
- Page content preview: ${pageContent || 'Could not fetch — site may be down or blocking bots'}

DEEP ANALYSIS INSTRUCTIONS:
1. Examine the domain structure — look-alike spelling, suspicious TLD (.tk .ml .ga .cf), random subdomains
2. Analyze reputation score — abuse reports, blacklist status
3. Examine page content — fake login forms, OTP requests, urgency language, brand impersonation
4. Cross-check domain vs page content — does domain match what the page claims to be?
5. Consider all signals TOGETHER for final verdict
6. Re-evaluate confidence strictly — be precise, not lenient
7. Provide 4-5 specific protective actions

JSON ONLY:
{
  "isScam": boolean,
  "confidence": number (1-99),
  "riskLevel": "Low"|"Medium"|"High",
  "scamType": "string",
  "explanation": "Detailed forensic breakdown covering domain analysis, reputation findings, page content review, and final verdict. One paragraph, no line breaks, entirely in ${lang.toUpperCase()}.",
  "advice": ["step1","step2","step3","step4","step5"]
}
CRITICAL: Write explanation and advice entirely in ${lang.toUpperCase()}.`
      : `You are a MALAYSIAN ANTI-FRAUD SPECIALIST. Analyze this URL for potential phishing or scams.

LANG_PREFERENCE: ${lang} (Provide "explanation" and "advice" in this language. Specifically support English, Malay, Chinese, and Tamil).

URL: "${url}"
Domain reputation: ${JSON.stringify(reputation)}
Database matches: ${dbMatches.length > 0 ? 'Found matches' : 'None'}
Page content preview: ${pageContent || 'Could not fetch page content'}

Consider:
- Look-alike domains ONLY when page content also impersonates a brand (e.g., domain says "may-bank" AND page shows Maybank logo/login). Domain similarity alone is NOT enough to flag as scam.
- Truly suspicious TLDs: .tk, .ml, .ga, .cf, .cyou, .pw — these are free/abused. Common TLDs like .online, .xyz, .top, .site are used by many legitimate businesses — do NOT flag these alone.
- Page content: OTP requests, fake bank UIs, credential harvesting forms, urgency language.
- Phishing tactics common in Malaysia.
- If no strong evidence of fraud, mark as safe — do not assume scam based on unfamiliar domain alone.

JSON ONLY:
{
  "isScam": boolean,
  "confidence": number (1-99, reflect genuine certainty — use low values like 40-65 when evidence is weak or mixed),
  "riskLevel": "Low" | "Medium" | "High",
  "scamType": "string (e.g., Phishing Link, Fake Bank Portal, or Legitimate if safe)",
  "explanation": "${explanationRule} MANDATORY: WRITE ENTIRELY IN ${lang.toUpperCase()}.",
  "advice": ["Action 1 IN ${lang.toUpperCase()}", "Action 2 IN ${lang.toUpperCase()}", "Action 3 IN ${lang.toUpperCase()}"]
}

CRITICAL: If language is 'ms', output Malay. If 'zh', output Chinese. If 'ta', output Tamil. If 'en', output English. YOU MUST COMPLY.`;

    let aiResult;
    if (skipAI) {
      console.log(`[Link Routing] Skipping AI — rule-based signals decisive (Mode: ${effectiveMode})`);
      aiResult = {
        isScam: true,
        confidence: 99,
        riskLevel: 'High',
        scamType: dbMatches[0]?.type || 'Phishing Link',
        explanation: getTranslation(lang, 'scamDetected') || 'This link has been flagged by multiple scam detection systems.',
        advice: [
          getTranslation(lang, 'noClick'),
          getTranslation(lang, 'reportScam') || 'Report this link to the authorities.',
          getTranslation(lang, 'verifyIndependently')
        ]
      };
    } else {
      const maxTokens = (aiModel === 'deep' || effectiveMode === 'auto→deep') ? 500 : 350;
      console.log(`[Link Routing] Using OpenAI GPT-4o mini (Mode: ${effectiveMode})`);
      try {
        if (!openai) throw new Error('OpenAI not configured');
        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }]
        });
        aiResult = parseOpenAIJson(openaiResponse.choices[0].message.content);
      } catch (e) {
        console.error('[Link] OpenAI error — falling back to Gemini:', e.message);
        try {
          const geminiResult = await geminiGenerateWithRetry(prompt);
          const raw = geminiResult.response.text().replace(/```json\n?/g, '').replace(/```/g, '').trim();
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) {
            aiResult = JSON.parse(match[0]);
          } else {
            return res.status(500).json({ error: 'AI analysis unavailable. Try again later.' });
          }
        } catch (ge) {
          console.error('[Link] Gemini fallback also failed:', ge.message);
          const isScam = dbMatches.length > 0 || reputation.isBlacklisted || reputation.abuseScore > 50;
          aiResult = {
            isScam,
            confidence: isScam ? 80 : 60,
            riskLevel: isScam ? 'High' : 'Low',
            scamType: dbMatches[0]?.type || (isScam ? 'Suspicious Link' : 'Unknown'),
            explanation: isScam
              ? 'This link has suspicious patterns. AI analysis temporarily unavailable — result based on pattern matching.'
              : 'No strong scam signals detected. AI analysis temporarily unavailable.',
            advice: [
              getTranslation(lang, 'noClick'),
              getTranslation(lang, 'reportScam'),
              getTranslation(lang, 'verifyIndependently'),
            ],
            aiUnavailable: true,
          };
        }
      }
    }

    // STEP 5: Boost only when AI was called and both signals agree (skipAI result is already 99%)
    if (!skipAI && (reputation.isBlacklisted || reputation.abuseScore > 50) && dbMatches.length > 0) {
      aiResult.confidence = Math.min((aiResult.confidence || 0) + 20, 97);
      aiResult.isScam = true;
      aiResult.riskLevel = 'High';
      aiResult.reputationCheck = reputation;
    }

    if (dbMatches.length > 0 && !aiResult.isScam) {
      // Trust database over AI if conflict
      aiResult.confidence = Math.max(aiResult.confidence, 97);
      aiResult.isScam = true;
      aiResult.riskLevel = 'High';
      aiResult.databaseMatches = dbMatches;
    }

    logAnalysis('link', url.substring(0, 50), aiResult);

    res.json({
      success: true,
      data: aiResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Link scan error:', error.message);
    res.status(500).json({
      error: 'Failed to analyze link',
      details: error.message
    });
  }
});

//  IMAGE SCANNING 
app.post('/api/scan-image', async (req, res) => {
  try {
    const { image, lang = 'en', aiModel = 'auto' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    console.log(`[Routing] Image -> Using OpenAI GPT-4o mini (Mode: ${aiModel})`);
    if (!image.includes(',')) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL.' });
    }
    const [header, base64Data] = image.split(',');
    const mimeType = header.split(':')[1]?.split(';')[0] || 'image/jpeg';

    let aiResult = null;
    try {
      const maxTokens = aiModel === 'deep' ? 700 : 350;
      const imgPrompt = aiModel === 'deep'
        ? `You are a SENIOR Malaysian cybersecurity forensic analyst. Perform DEEP VISUAL ANALYSIS on this image. Reply entirely in ${lang}.

DEEP ANALYSIS INSTRUCTIONS:
1. Read ALL text visible in the image carefully
2. Examine visual design — logos, layout, fonts, colours — do they match the real brand?
3. Check for red flags: OTP/PIN requests, suspicious URLs, urgency language, payment demands
4. For receipts — verify reference number format (real IBG/DuitNow: 8-18 alphanumeric chars; fake: too short, repeated digits, missing)
5. Check sender identity — impersonation of bank, government, courier, e-commerce?
6. Consider ALL visual and text signals together for final verdict
7. Provide 4-5 specific protective actions

BANK RECEIPT KNOWLEDGE:
- Real Malaysian IBG/DuitNow/FPX: alphanumeric 8-18 characters
- Real UPI/Instant: 12-digit RRN
- FAKE: reference under 8 digits, repeated digits (111111), no reference at all
- Logo alone does NOT prove real — scammers copy logos

JSON ONLY: {"isScam":bool,"confidence":(1-99),"riskLevel":"Low|Medium|High","scamType":"string","explanation":"Detailed forensic breakdown of visual elements, text content, suspicious indicators found, and final verdict. One paragraph, no line breaks, entirely in ${lang.toUpperCase()}.","advice":["step1","step2","step3","step4","step5"],"extractedText":"all text read from image"}`
        : `Malaysian anti-fraud specialist. Detect scam/fraud in this image.
Lang: ${lang}. Write explanation+advice entirely in ${lang.toUpperCase()}.
Detect: fake bank UIs, phishing SMS, OTP/PIN demands, suspicious URLs, fake receipts, LHDN/Maybank/Shopee impersonation.

BANK RECEIPT REFERENCE NUMBER KNOWLEDGE (critical — do NOT trust logo alone):
- Real Malaysian IBG/DuitNow/FPX: alphanumeric 8-18 characters (e.g. "RN2024050112345678")
- Real UPI/Instant transfers: 12-digit Retrieval Reference Number (RRN)
- Real SWIFT international wire: 16-20 digits
- FAKE receipt red flags: reference under 8 digits, all-repeated digits (111111, 000000), no reference number at all, or reference that looks randomly typed
- A Maybank/CIMB/RHB logo on the receipt does NOT prove it is real — scammers copy logos. Verify the reference number format.

JSON ONLY: {"isScam":bool,"confidence":(1-99),"riskLevel":"Low|Medium|High","scamType":"string","explanation":"Max 1-2 short sentences.","advice":["...","...","..."],"extractedText":"..."}`;
      if (!openai) throw new Error('OpenAI not configured');
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: [
          { type: 'text', text: imgPrompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: 'low' } }
        ]}]
      });
      aiResult = parseOpenAIJson(response.choices[0].message.content);
    } catch (e) {
      console.log('[Image Routing] OpenAI failed — falling back to Gemini Vision:', e.message);
      aiResult = await analyzeImageWithGemini(image, lang, aiModel);
    }

    if (aiResult) {
      // Check for whitelist match in extracted text as extra safety
      const whitelistCheck = checkOfficalWhitelist(aiResult.extractedText || '');
      if (whitelistCheck.isWhitelisted && !aiResult.isScam) {
        aiResult.confidence = Math.max(aiResult.confidence, 98);
        aiResult.explanation = `Legitimate content from ${whitelistCheck.type}. verified safe.`;
      }

      // Receipt detection — inject verification advisory regardless of AI verdict
      const receiptKeywords = /\b(reference\s*(?:id|no|number)|ref(?:erence)?\s*[:：]|beneficiary|transaction\s*(?:id|ref)|receipt|scan\s*&?\s*pay|duitnow|ibg|rentas|fpx|successful|amount\s*(?:rm|myr)|rm\s*\d|transfer(?:red)?)\b/i;
      const isReceiptImage = receiptKeywords.test(aiResult.extractedText || '') || receiptKeywords.test(aiResult.explanation || '');

      if (isReceiptImage) {
        const receiptAdvice = {
          en: 'Always verify received payments in YOUR OWN bank app transaction history — never trust a receipt sent by the other party. Screenshots can be faked or reused.',
          ms: 'Sentiasa sahkan pembayaran yang diterima dalam sejarah transaksi apl bank ANDA SENDIRI — jangan percaya resit yang dihantar pihak lain. Tangkapan skrin boleh dipalsukan.',
          zh: '请务必在您自己的银行应用程序交易记录中核实收款——切勿相信对方发来的收据截图，截图可以伪造或重复使用。',
          ta: 'உங்கள் சொந்த வங்கி பயன்பாட்டில் பரிவர்த்தனை வரலாற்றில் பணம் வந்துள்ளதை சரிபார்க்கவும் — எதிர் தரப்பினர் அனுப்பும் ரசீதை நம்பாதீர்கள். திரைப்படங்கள் போலியாக இருக்கலாம்.',
        };
        const advisoryText = receiptAdvice[lang] || receiptAdvice.en;
        // Inject as first advice item if not already present
        if (!aiResult.advice) aiResult.advice = [];
        if (!aiResult.advice.some(a => a.includes('own bank') || a.includes('bank app') || a.includes('apl bank') || a.includes('银行应用') || a.includes('வங்கி'))) {
          aiResult.advice.unshift(advisoryText);
        }
        // Cap confidence — screenshot alone cannot confirm payment completed
        if (!aiResult.isScam) {
          aiResult.confidence = Math.min(aiResult.confidence, 75);
          aiResult.isReceiptImage = true;
        }
      }

      aiResult.ocr_success = true;
      logAnalysis('image', (aiResult.extractedText || '').substring(0, 50), aiResult);

      return res.json({
        success: true,
        data: aiResult,
        timestamp: new Date().toISOString()
      });
    }

    // Fallback if AI fails
    res.json({
      success: true,
      data: {
        isScam: true,
        confidence: 70,
        riskLevel: 'High',
        scamType: 'Image Analysis Failed',
        explanation: getTranslation(lang, 'imageFailed'),
        advice: [getTranslation(lang, 'noClick'), getTranslation(lang, 'verifyIndependently')],
        extractedText: 'Processing error',
        ocr_success: false
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Image scan error:', error.message);
    res.status(500).json({
      error: 'Failed to analyze image',
      details: error.message
    });
  }
});

//  TRANSLATE RESULT (live language switching without re-scan)
app.post('/api/translate-result', async (req, res) => {
  try {
    const { explanation, advice, scamType, targetLang } = req.body;
    if (!explanation || !targetLang) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const langNames = { en: 'English', ms: 'Malay', zh: 'Chinese (Simplified)', ta: 'Tamil' };
    const langName = langNames[targetLang] || 'English';

    const prompt = `Translate ALL the following fields to ${langName}. Return ONLY a valid JSON object.

{
  "explanation": ${JSON.stringify(explanation)},
  "advice": ${JSON.stringify(advice)},
  "scamType": ${JSON.stringify(scamType)}
}

STRICT RULES:
1. Translate ALL text to ${langName}
2. Keep the exact same JSON structure
3. Return ONLY the JSON object, NO markdown, NO extra text
4. Keep the same tone and meaning
5. scamType should be translated naturally
6. Each advice item must remain a separate array element
7. Do NOT add or remove any fields`;

    let responseText = '';
    try {
      const result = await geminiGenerateWithRetry(prompt);
      responseText = result.response.text();
    } catch (e) {
      console.warn('[Translate] Gemini failed, trying OpenAI fallback:', e.message);
      if (!openai) throw new Error('OpenAI not configured');
      const openaiResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      });
      responseText = openaiResponse.choices[0].message.content;
    }

    responseText = responseText.replace(/```json\n/g, '').replace(/```\n/g, '').replace(/```/g, '').trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const translated = JSON.parse(jsonMatch[0]);
      console.log(`[Translate] Translated to ${langName}`);
      return res.json({ success: true, data: translated });
    }
    throw new Error('Could not parse translation response');
  } catch (error) {
    console.error('[Translate] Error:', error.message);
    res.status(500).json({ error: 'Translation failed', details: error.message });
  }
});

//  SAVE REPORT 
app.post('/api/save-report', async (req, res) => {
  try {
    const { message, isScam, riskLevel, scamType, explanation, advice, type, confidence, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const report = {
      content: message,
      type: type || 'message',
      isScam: Boolean(isScam),
      riskLevel: riskLevel || 'Unknown',
      scamType: scamType || 'Unknown',
      explanation: explanation || '',
      advice: Array.isArray(advice) ? advice : [],
      confidence: confidence || 0,
      userId: userId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toLocaleString('en-MY'),
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    const docRef = await db.collection('scam_reports').add(report);

    console.log(`Report saved: ${docRef.id}`);

    res.json({
      success: true,
      reportId: docRef.id,
      message: 'Report saved successfully'
    });

  } catch (error) {
    console.error('Save report error:', error.message);
    require('fs').appendFileSync('error_log.txt', new Date().toISOString() + ' Save report error: ' + error.message + '\n' + JSON.stringify(req.body) + '\n');
    res.status(500).json({
      error: 'Failed to save report',
      details: error.message
    });
  }
});

//  USER FEEDBACK SYSTEM 
app.post('/api/feedback', async (req, res) => {
  try {
    const { reportId, userCorrection, feedback } = req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    const feedbackDoc = await db.collection('user_feedback').add({
      reportId,
      userCorrection: Boolean(userCorrection),
      feedback: feedback || '',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    console.log(`Feedback saved: ${feedbackDoc.id}`);

    res.json({
      success: true,
      feedbackId: feedbackDoc.id,
      message: 'Thank you! Your feedback helps us improve.'
    });

  } catch (error) {
    console.error('Feedback error:', error.message);
    res.status(500).json({
      error: 'Failed to save feedback',
      details: error.message
    });
  }
});

// Get feedback statistics
app.get('/api/feedback-stats', async (req, res) => {
  try {
    const snapshot = await db.collection('user_feedback').get();

    let correctCount = 0;
    let totalCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.userCorrection === true) correctCount++;
      totalCount++;
    });

    const accuracy = totalCount > 0 ? (correctCount / totalCount * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        totalFeedback: totalCount,
        correctPredictions: correctCount,
        accuracy: accuracy + '%'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch feedback stats',
      details: error.message
    });
  }
});

// ==================== GET REPORTS ====================
app.get('/api/reports', async (req, res) => {
  try {
    const { userId } = req.query;
    let query = db.collection('scam_reports').limit(100);
    if (userId) query = query.where('userId', '==', userId);
    else query = query.orderBy('timestamp', 'desc');
    const snapshot = await query.get();

    const reports = [];
    snapshot.forEach(doc => {
      reports.push({ id: doc.id, ...doc.data() });
    });

    if (userId) {
      reports.sort((a, b) => {
        const ta = a.timestamp?._seconds ?? 0;
        const tb = b.timestamp?._seconds ?? 0;
        return tb - ta;
      });
    }

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });

  } catch (error) {
    res.json({
      success: true,
      data: [],
      count: 0,
      message: 'No reports found'
    });
  }
});

app.get('/api/reports/:id', async (req, res) => {
  try {
    const doc = await db.collection('scam_reports').doc(req.params.id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data()
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch report',
      details: error.message
    });
  }
});

// Get statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const snapshot = await db.collection('scam_reports').get();

    const stats = {
      totalReports: snapshot.size,
      scamReports: 0,
      safeReports: 0,
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      commonScamTypes: {}
    };

    snapshot.forEach(doc => {
      const data = doc.data();

      if (data.isScam) stats.scamReports++;
      else stats.safeReports++;

      if (data.riskLevel === 'High') stats.highRiskCount++;
      if (data.riskLevel === 'Medium') stats.mediumRiskCount++;
      if (data.riskLevel === 'Low') stats.lowRiskCount++;

      if (data.scamType) {
        stats.commonScamTypes[data.scamType] = (stats.commonScamTypes[data.scamType] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch statistics',
      details: error.message
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.collection('_health').doc('test').get();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      api: 'operational',
      ocr: 'enabled',
      emotionalAnalysis: 'enabled (built-in)',
      phoneValidator: 'enabled',
      domainReputation: 'enabled',
      officialWhitelist: 'enabled',
      userFeedback: 'enabled'
    });
  } catch (error) {
    res.status(500).json({
      status: 'degraded',
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error.message, error.stack);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\nAvailable endpoints:`);
  console.log('  POST /api/scan-message');
  console.log('  POST /api/scan-link');
  console.log('  POST /api/scan-image (with OCR)');
  console.log('  POST /api/save-report');
  console.log('  POST /api/feedback');
  console.log('  GET  /api/reports');
  console.log('  GET  /api/reports/:id');
  console.log('  GET  /api/statistics');
  console.log('  GET  /api/feedback-stats');
  console.log('  GET  /api/health');
  console.log('\n✓ FIXED System ready for scanning!\n');
});