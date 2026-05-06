
const scamDatabase = {
  //  OFFICIAL WHITELIST
  officialWhitelist: [
    // Official Maybank — anchored with (?:\/|$) so fake.maybank2u.com.my.evil.net cannot match
    { pattern: /(?:^|\/)(?:www\.)?maybank2u\.com\.my(?:\/|$)|(?:^|\/)(?:www\.)?maybank\.com\.my(?:\/|$)/, type: 'Maybank Official', risk: 'Low' },

    // Official CIMB
    { pattern: /(?:^|\/)(?:www\.)?cimb\.com\.my(?:\/|$)|(?:^|\/)(?:www\.)?cimb\.co\.id(?:\/|$)|(?:^|\/)(?:www\.)?cimbclicks\.com(?:\/|$)/i, type: 'CIMB Official', risk: 'Low' },

    // Official Public Bank
    { pattern: /(?:^|\/)(?:www\.)?publicbank\.com\.my(?:\/|$)/, type: 'Public Bank Official', risk: 'Low' },

    // Official HSBC
    { pattern: /(?:^|\/)(?:www\.)?hsbc\.com\.my(?:\/|$)/, type: 'HSBC Official', risk: 'Low' },

    // Official RHB
    { pattern: /(?:^|\/)(?:www\.)?rhb\.com\.my(?:\/|$)/, type: 'RHB Official', risk: 'Low' },

    // Official AmBank
    { pattern: /(?:^|\/)(?:www\.)?ambank\.com\.my(?:\/|$)/, type: 'AmBank Official', risk: 'Low' },

    // Official Affin
    { pattern: /(?:^|\/)(?:www\.)?affin\.com\.my(?:\/|$)/, type: 'Affin Official', risk: 'Low' },

    // Official UOB
    { pattern: /(?:^|\/)(?:www\.)?uob\.com\.my(?:\/|$)/, type: 'UOB Official', risk: 'Low' },

    // Official Bank Islam
    { pattern: /(?:^|\/)(?:www\.)?bankislam\.com\.my(?:\/|$)/, type: 'Bank Islam Official', risk: 'Low' },

    // Official Postal Services
    { pattern: /(?:^|\/)(?:www\.)?pos\.com\.my(?:\/|$)|(?:^|\/)(?:www\.)?poslaju\.com\.my(?:\/|$)/, type: 'Pos Malaysia Official', risk: 'Low' },

    // Official Delivery Services
    { pattern: /(?:^|\/)(?:www\.)?dhl\.com(?:\.my)?(?:\/|$)|(?:^|\/)(?:www\.)?fedex\.com(?:\.my)?(?:\/|$)|(?:^|\/)(?:www\.)?ups\.com(?:\.my)?(?:\/|$)/, type: 'Official Delivery', risk: 'Low' },

    // Official Ride Services
    { pattern: /(?:^|\/)(?:www\.)?grab\.com(?:\.my)?(?:\/|$)/, type: 'Grab Official', risk: 'Low' },

    // Official E-commerce
    { pattern: /(?:^|\/)(?:www\.)?shopee\.com(?:\.my)?(?:\/|$)|(?:^|\/)(?:www\.)?lazada\.com(?:\.my)?(?:\/|$)/, type: 'Official E-commerce', risk: 'Low' },

    // Official Government
    { pattern: /(?:^|\/)(?:www\.)?lhdn\.gov\.my(?:\/|$)|(?:^|\/)(?:www\.)?pdrm\.gov\.my(?:\/|$)|(?:^|\/)(?:www\.)?bnm\.gov\.my(?:\/|$)|(?:^|\/)(?:www\.)?bnm\.my(?:\/|$)/, type: 'Government Official', risk: 'Low' },
    
    // Bank TAC / OTP messages — always legitimate, never share but not a scam
    { pattern: /(?:maybank|cimb|rhb|public\s*bank|hong\s*leong|ambank|affin|bsn|bank\s*islam|hsbc|uob|alliance).*(?:TAC|OTP|pin).*(?:do not share|jangan kongsi|valid for|sah selama)/i, type: 'Bank OTP/TAC', risk: 'Low' },
    { pattern: /(?:TAC|OTP)\s*(?:no\.?|number|kod)\s*(?:is|ialah|adalah)?\s*\d{4,8}/i, type: 'Bank OTP/TAC', risk: 'Low' },
    { pattern: /RM0\.00\s+(?:Maybank|CIMB|RHB|Public Bank|Hong Leong|AmBank)/i, type: 'Bank OTP/TAC', risk: 'Low' },

    // Personal/Natural Messages
    { pattern: /^(hi|hello|hey|good morning|how are you|see you|meeting|appointment|order|shipped|delivery|appointment confirmed)/i, type: 'Personal Message', risk: 'Low' },
    { pattern: /^maybank2u\s*\|\s*maybank\s*malaysia$/i, type: 'Brand Information', risk: 'Low' },
  ],

  //  PARCEL SCAMS 
  parcelScams: [
    // ONLY match FAKE domain patterns + suspicious content together
    { pattern: /dhl.*\.(tk|ml|ga|cf|xyz|info|biz|site|top|online|click|shop|store|live|world|today|icu|vip).*(?:verify|confirm|payment|urgent)/i, type: 'Parcel Scam', risk: 'High' },
    { pattern: /poslaju.*\.(tk|ml|ga|cf|xyz|info|biz|site|top|online|click|shop|store|live|world|today|icu|vip)/i, type: 'Parcel Scam', risk: 'High' },
    { pattern: /fedex.*\.(tk|ml|ga|cf|xyz|info|biz|site|top|online).*(?:confirm|verify)/i, type: 'Parcel Scam', risk: 'High' },
    { pattern: /jnt.*\.(tk|ml|ga|cf|xyz|info|biz|site|top|online)/i, type: 'Parcel Scam', risk: 'High' },
    { pattern: /ninjavan.*\.(tk|ml|ga|cf|xyz|info|biz|site|top|online)/i, type: 'Parcel Scam', risk: 'High' },
    // Fake delivery services
    { pattern: /parcel.*pending.*(?:pay|click|verify|confirm)/i, type: 'Parcel Scam', risk: 'High' },
    { pattern: /delivery.*failed.*(?:update.*address|confirm|payment)/i, type: 'Parcel Scam', risk: 'High' },
    { pattern: /customs.*duty.*(?:RM\d+|payment|pay)/i, type: 'Parcel Scam', risk: 'High' },
    { pattern: /package.*held.*payment.*due/i, type: 'Parcel Scam', risk: 'High' },
  ],

  //  BANK SCAMS 
  bankScams: [
    // ONLY match misspelled + suspicious content together
    { pattern: /mayb4nk.*(?:verify|password|otp|confirm)/i, type: 'Bank Scam', risk: 'High' },
    { pattern: /cimb.*(?:verify.*account|confirm.*password|update.*card)/i, type: 'Bank Scam', risk: 'High' },
    { pattern: /publicbank.*(?:verify|secure.*login|update.*details)/i, type: 'Bank Scam', risk: 'High' },
    { pattern: /hsbc.*(?:confirm.*card|verify.*account)/i, type: 'Bank Scam', risk: 'High' },
    // Account compromise patterns
    { pattern: /(?:unusual.*activity|suspicious.*login|account.*locked|account.*suspended).*(?:verify|confirm|click)/i, type: 'Bank Scam', risk: 'High' },
    { pattern: /(?:otp|password|card.*details|banking.*password).*(?:required|confirm|send)/i, type: 'Bank Scam', risk: 'High' },
    { pattern: /(?:card.*expired|card.*blocked|card.*compromised).*(?:update|verify|click)/i, type: 'Bank Scam', risk: 'High' },
  ],

  // GOVERNMENT SCAMS 
  governmentScams: [
    // LHDN + payment request
    { pattern: /lhdn.*(?:verify|confirm|refund.*claim).*\.(tk|ml|ga)/i, type: 'Government Scam', risk: 'High' },
    { pattern: /(?:tax.*refund|claim.*refund).*(?:lhdn|click|verify).*(?:RM|payment)/i, type: 'Government Scam', risk: 'High' },
    // PDRM + payment
    { pattern: /pdrm.*(?:saman|fine).*(?:payment|pay|click).*\.(tk|ml|ga)/i, type: 'Government Scam', risk: 'High' },
    { pattern: /outstanding.*saman.*(?:payment.*required|urgent.*pay)/i, type: 'Government Scam', risk: 'High' },
    // BNM
    { pattern: /bnm.*(?:alert|verify).*\.(tk|ml|ga)/i, type: 'Government Scam', risk: 'High' },
  ],

  //  INVESTMENT SCAMS 
  investmentScams: [
    // Must have clear scam indicators
    { pattern: /(?:guaranteed.*returns|100%.*safe|risk.*free).*(?:invest|bitcoin|forex|crypto)/i, type: 'Investment Scam', risk: 'High' },
    { pattern: /(?:50%.*monthly|300%.*yearly|double.*money).*(?:limited|hurry|join)/i, type: 'Investment Scam', risk: 'High' },
    { pattern: /(?:bitcoin|ethereum|crypto|forex|binary).*(?:guaranteed|safe|easy|passive.*income)/i, type: 'Investment Scam', risk: 'High' },
    { pattern: /(?:passive.*income|downline|referral.*bonus|mlm|network).*(?:join|group|telegram|whatsapp)/i, type: 'Investment Scam', risk: 'High' },
    { pattern: /(?:limited.*spots|hurry.*join|final.*call).*(?:telegram|group|dm|message)/i, type: 'Investment Scam', risk: 'High' },
  ],

  //  ROMANCE/CATFISH SCAMS 
  romanceScams: [
    { pattern: /(?:i.*love.*you|marry.*you|sweetheart|darling).*(?:send.*money|gift.*card|help.*pay)/i, type: 'Romance Scam', risk: 'High' },
    { pattern: /(?:medical.*emergency|surgery|accident|hospital).*(?:help.*me|send.*money|payment)/i, type: 'Romance Scam', risk: 'High' },
    { pattern: /(?:investment.*together|business.*opportunity).*(?:send|transfer|need)/i, type: 'Romance Scam', risk: 'High' },
  ],

  // JOB SCAMS 
  jobScams: [
    { pattern: /(?:work.*from.*home|easy.*money|quick.*cash).*(?:no.*experience|register|deposit|fee)/i, type: 'Job Scam', risk: 'High' },
    { pattern: /(?:data.*entry|typing|form.*filling).*(?:earn|money).*(?:registration|deposit|fee)/i, type: 'Job Scam', risk: 'High' },
    { pattern: /(?:mystery.*shopper|product.*tester).*(?:fee|deposit|payment.*required)/i, type: 'Job Scam', risk: 'High' },
    { pattern: /(?:hiring.*now|urgent.*recruitment|apply.*now).*(?:deposit|fee|register)/i, type: 'Job Scam', risk: 'High' },
  ],

  //  LOTTERY/PRIZE SCAMS 
  lotteryScams: [
    { pattern: /(?:congratulations.*won|you.*won|claim.*prize).*(?:processing.*fee|tax|payment)/i, type: 'Lottery Scam', risk: 'High' },
    { pattern: /(?:lottery.*winner|draw.*winner|lucky.*draw).*(?:claim|fee|payment)/i, type: 'Lottery Scam', risk: 'High' },
    { pattern: /(?:RM\d{4,}|jackpot|millions).*(?:congratulations|won).*(?:claim|fee)/i, type: 'Lottery Scam', risk: 'High' },
  ],

  //  PHISHING SCAMS 
  phishingScams: [
    { pattern: /(?:click.*here|click.*now|verify.*account|confirm.*identity).*\.(tk|ml|ga|cf)/i, type: 'Phishing Scam', risk: 'High' },
    { pattern: /(?:bit\.ly|tinyurl|short\.link|goo\.gl|ow\.ly).*(?:verify|login|account)/i, type: 'Phishing Scam', risk: 'High' },
    { pattern: /(?:update.*information|validate.*account|authenticate).*\.(tk|ml|ga)/i, type: 'Phishing Scam', risk: 'High' },
  ],

  // GAMBLING/BETTING SCAMS 
  gamblingScams: [
    { pattern: /(?:sports.*betting|football.*tips|sure.*win).*(?:guaranteed|click|join|group)/i, type: 'Gambling Scam', risk: 'High' },
    { pattern: /(?:lottery.*prediction|4d.*number|toto).*(?:guaranteed|win|tips)/i, type: 'Gambling Scam', risk: 'High' },
    { pattern: /(?:casino|live.*casino).*(?:easy.*money|big.*win|join)/i, type: 'Gambling Scam', risk: 'High' },
  ],

  // HEALTH SCAMS 
  healthScams: [
    { pattern: /(?:covid.*vaccine|vaccine.*verification).*(?:verify|click|confirm).*\.(tk|ml|ga)/i, type: 'Health Scam', risk: 'High' },
    { pattern: /(?:miracle.*cure|wonder.*drug|instant.*relief).*(?:buy|order|payment)/i, type: 'Health Scam', risk: 'High' },
    { pattern: /(?:hospital.*bill|doctor.*appointment).*(?:urgent|payment|pay)/i, type: 'Health Scam', risk: 'High' },
  ],

  // RENTAL SCAMS 
  rentalScams: [
    { pattern: /(?:apartment.*listing|house.*for.*rent|room.*for.*rent).*(?:cheap|low.*price).*(?:deposit|payment)/i, type: 'Rental Scam', risk: 'High' },
    { pattern: /(?:airbnb|vacation.*rental|booking).*(?:confirm|payment.*required)/i, type: 'Rental Scam', risk: 'High' },
  ],

  //TRAVEL SCAMS 
  travelScams: [
    { pattern: /(?:cheap.*flight|flight.*deal|airline.*booking).*(?:limited|hurry|book.*now).*(?:payment|click)/i, type: 'Travel Scam', risk: 'High' },
    { pattern: /(?:hotel.*booking|resort.*package).*(?:special.*price|limited).*(?:payment)/i, type: 'Travel Scam', risk: 'High' },
    { pattern: /(?:holiday.*package|tour.*package).*(?:flash.*sale|limited).*(?:book|payment)/i, type: 'Travel Scam', risk: 'High' },
  ],

  // E-COMMERCE SCAMS 
  ecommerceScams: [
    { pattern: /(?:shopee|lazada).*(?:verify|confirm).*\.(tk|ml|ga)/i, type: 'E-commerce Scam', risk: 'High' },
    { pattern: /(?:order.*cancelled|payment.*failed|refund.*pending).*(?:click|verify|confirm).*\.(tk|ml|ga)/i, type: 'E-commerce Scam', risk: 'High' },
  ],

  // SAFE INDICATORS 
  safeIndicators: [
    { pattern: /^(hi|hello|hey|good morning|how are you)/, type: 'Personal Message', risk: 'Low' },
    { pattern: /(?:meeting|appointment|order|shipped|delivery).*(?:confirmed|scheduled|on.*way)/i, type: 'Legitimate Service', risk: 'Low' },
    { pattern: /see.*you.*(?:tomorrow|later|soon)/, type: 'Personal Message', risk: 'Low' },
  ],
};

module.exports = scamDatabase;