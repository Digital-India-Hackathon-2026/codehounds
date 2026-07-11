import { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  Brain, 
  ListChecks, 
  Activity, 
  ShieldAlert 
} from 'lucide-react';
import { fetchAPI } from '../lib/api';

interface AnalyzeTextRequest {
  text: string;
}

interface Indicator {
  type: string;
  description: string;
  confidence: number;
}

interface SimilarScam {
  campaign_name: string;
  similarity_score: number;
  scam_type: string;
}

interface AnalyzeResponse {
  risk_score: number;
  risk_level: string;
  scam_type: string;
  confidence: number;
  indicators: Indicator[];
  transcript?: string;
  language?: string;
  similar_scams: SimilarScam[];
  lstm_risk_score?: number;
  lstm_risk_level?: string;
  lstm_confidence?: number;
}

const getAIExplanation = (scamType: string, riskLevel: string, indicators: Indicator[]) => {
  const indNames = indicators.map(ind => ind.type).join(', ');
  const indicatorPhrase = indicators.length > 0 ? ` containing indicators such as [${indNames}]` : '';
  
  switch (scamType.toLowerCase()) {
    case 'phishing':
      return `Our AI model has flagged this text as a Phishing attempt${indicatorPhrase}. It mimics communications from trusted organizations to harvest sensitive credentials or financial details. The risk evaluation indicates standard deceptive linguistic patterns matching phishing campaigns.`;
    case 'lottery':
      return `This message displays classic signs of a Lottery scam${indicatorPhrase}, telling you that you have won a large prize or sweepstakes. These scams typically require the victim to pay an upfront "processing fee" or share bank details. AI confirms a high correlation with advance-fee fraud.`;
    case 'tech support':
    case 'support':
      return `Classified as a Fake Tech Support scam${indicatorPhrase}. The text creates a false sense of urgency regarding device security, account locks, or unauthorized transactions to trick you into downloading remote control software or making payments.`;
    case 'delivery':
      return `Identified as a Delivery Scam (such as fake UPS, FedEx, or USPS alerts)${indicatorPhrase}. It claims a package cannot be delivered or requires a small payment. The AI model identified patterns designed to steal delivery tracking information and payment card details.`;
    case 'financial':
    case 'investment':
      return `This is classified as a Fraudulent Investment / Crypto scam${indicatorPhrase}. It promises high returns with zero risk or requests deposits to unverified platforms. Our models show clear deceptive sentiment and exaggerated promises typical of financial fraud.`;
    case 'job':
    case 'employment':
      return `This message matches patterns of a Fake Job / Employment scam${indicatorPhrase}. It offers high-paying remote work with minimal effort, designed to collect personal identity documents or solicit upfront setup fees from applicants.`;
    case 'legitimate':
      return `The message appears to be legitimate. Our models analyzed the structure, links, and tone, finding no malicious indicators or threat patterns. However, always exercise caution before clicking unexpected links.`;
    default:
      if (riskLevel === 'HIGH_RISK' || riskLevel === 'CRITICAL') {
        return `This message has been classified as a threat (${scamType})${indicatorPhrase} with a high severity level. The combined indicators and linguistic markers suggest an active scam campaign designed to manipulate the recipient.`;
      }
      return `Analyzed message classified as ${scamType || 'Legitimate'}. The system detected low to moderate risk, but we recommend verifying the sender's identity through official channels if the content is unexpected.`;
  }
};

const getRecommendations = (scamType: string) => {
  switch (scamType.toLowerCase()) {
    case 'phishing':
      return [
        "Do not click on any links in the message; verify the claim by navigating to the official website directly.",
        "Never input your credentials or OTPs on pages linked from unsolicited SMS or email messages.",
        "Report the sender's address or phone number to your service provider and block it immediately."
      ];
    case 'lottery':
      return [
        "Remember that you cannot win a lottery or contest that you did not explicitly enter.",
        "Never send money, gift cards, or crypto to claim a prize or pay 'taxes/fees' upfront.",
        "Do not share personal documents (IDs, bank account details) with the organizers."
      ];
    case 'tech support':
    case 'support':
      return [
        "Do not call any phone numbers listed in the message or download remote assistance tools (e.g. AnyDesk, TeamViewer).",
        "Official support teams will never contact you out of the blue to report device malware or lockups.",
        "Log into your account via the official app or website to check if there are any genuine alerts."
      ];
    case 'delivery':
      return [
        "Do not open links or reply to messages asking for address confirmation or unpaid fees.",
        "Use the official shipping company website and input the tracking number directly to check status.",
        "Block the sender and report the text to the carrier's spam line (7726 for SMS)."
      ];
    case 'financial':
    case 'investment':
      return [
        "Avoid any investment opportunity that guarantees high yields with little or no risk.",
        "Check if the provider is registered with national financial regulatory authorities.",
        "Never send funds to anonymous wallet addresses or unverified payment platforms."
      ];
    case 'job':
    case 'employment':
      return [
        "Be wary of recruiters offering high wages for simple, flexible remote tasks with no interview.",
        "Never pay for your own background checks, training materials, or starter kits.",
        "Verify the company and job posting on reputable portals like LinkedIn or the official company careers page."
      ];
    default:
      return [
        "Verify the sender's identity through an independent, official channel (like a public phone directory).",
        "Do not share sensitive personal information, credentials, or bank details over SMS or chat apps.",
        "If you are concerned, contact the organization's official customer support line directly."
      ];
  }
};

export default function TextAnalysis() {
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeText = async () => {
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response: AnalyzeResponse = await fetchAPI('/analyze/text', {
        method: 'POST',
        body: JSON.stringify({ text } as AnalyzeTextRequest)
      });

      setResult({
        text,
        scamType: response.scam_type,
        riskScore: response.risk_score, // Backend returns 0-1.0 already
        riskLevel: response.risk_level,
        confidence: response.confidence,
        timestamp: new Date().toLocaleTimeString(),
        indicators: response.indicators,
        similarScams: response.similar_scams,
        lstmRiskScore: response.lstm_risk_score !== undefined ? response.lstm_risk_score : null,
        lstmRiskLevel: response.lstm_risk_level || 'UNKNOWN',
        lstmConfidence: response.lstm_confidence !== undefined ? response.lstm_confidence : null
      });
      setText('');
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskLevelStyles = (level: string) => {
    switch (level) {
      case 'SAFE':
        return 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'SUSPICIOUS':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'HIGH_RISK':
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-error/10 text-error border-error/30 animate-pulse';
      default:
        return 'bg-white/10 text-white border-white/20';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Text Analysis</h1>
        <p className="text-secondary font-mono text-sm">BERT MULTILINGUAL CLASSIFIER & BILSTM THREAT COPROCESSOR • SMS / WHATSAPP / EMAIL</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="glass-panel p-6 flex flex-col h-[650px]">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-white" />
            <h2 className="font-mono font-bold tracking-widest text-sm text-white">INPUT MESSAGE</h2>
          </div>
          
          <textarea 
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste suspicious SMS, WhatsApp message, or email content here..."
            className="flex-1 w-full bg-surface border border-white/10 rounded-xl p-4 text-white placeholder-secondary focus:outline-none focus:border-white/30 resize-none transition-colors"
          />
          
          {error && <p className="mt-4 text-sm text-error">{error}</p>}

          <div className="mt-4 flex justify-end">
            <button 
              onClick={analyzeText}
              disabled={!text.trim() || isAnalyzing}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold tracking-wide transition-all ${
                !text.trim() || isAnalyzing
                  ? 'bg-surface text-secondary cursor-not-allowed'
                  : 'bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
              }`}
            >
              {isAnalyzing ? 'CLASSIFYING...' : 'ANALYZE TEXT'}
              {!isAnalyzing && <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="glass-panel p-6 flex flex-col h-[650px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4 sticky top-0 bg-[#111111]/80 backdrop-blur-md z-10">
            <h2 className="font-mono font-bold tracking-widest text-sm text-white">THREAT INTELLIGENCE REPORT</h2>
          </div>

          {!result && !isAnalyzing && (
             <div className="flex-1 flex items-center justify-center text-secondary font-mono text-sm text-center">
               AWAITING TEXT INPUT
             </div>
          )}

          <div className="space-y-6">
            {isAnalyzing && (
              <div className="glass-card p-6 border-dashed border-white/20 animate-pulse flex flex-col items-center justify-center h-48 gap-4">
                <Activity className="w-8 h-8 text-white animate-spin" />
                <span className="font-mono text-xs text-secondary">RUNNING BERT CLASSIFICATION & RAG MATCHING...</span>
              </div>
            )}
            
            {result && (
              <div className="flex flex-col gap-6 animate-in slide-in-from-right duration-300">
                {/* Header Summary */}
                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-secondary">TIMESTAMP</span>
                    <span className="text-sm font-medium text-white">{result.timestamp}</span>
                  </div>
                  <div className="flex gap-6 items-center">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-mono text-secondary">OVERALL RISK SCORE</span>
                      <span className="text-sm font-bold text-white font-mono">{(result.riskScore * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-mono text-secondary mb-1">OVERALL THREAT LEVEL</span>
                      <span className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full border ${getRiskLevelStyles(result.riskLevel)}`}>
                        <ShieldAlert className="w-3.5 h-3.5" /> {result.riskLevel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Analyzed Message */}
                <div className="bg-[#111111] p-4 rounded-xl border border-white/10">
                  <span className="text-[10px] font-mono text-secondary block mb-1">ANALYZED CONTENT</span>
                  <p className="text-sm text-white italic">"{result.text}"</p>
                </div>

                {/* Models Output Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Classification (BERT) */}
                  <div className="glass-card p-4 flex flex-col justify-between border border-white/5">
                    <div>
                      <span className="text-[10px] text-secondary font-mono">SCAM CLASSIFICATION (BERT)</span>
                      <p className="text-base font-bold text-white mt-1">{result.scamType}</p>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-mono text-secondary mb-1.5">
                        <span>Confidence</span>
                        <span>{(result.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                        <div 
                          className="bg-white h-full rounded-full transition-all duration-1000"
                          style={{ width: `${result.confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Risk Score (BiLSTM) */}
                  <div className="glass-card p-4 flex flex-col justify-between border border-white/5">
                    <div>
                      <span className="text-[10px] text-secondary font-mono">RISK SCORE (BiLSTM)</span>
                      <p className="text-base font-bold text-white mt-1">
                        {result.lstmRiskScore !== null ? `${(result.lstmRiskScore * 100).toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-mono text-secondary mb-1.5">
                          <span>Risk Level</span>
                          <span>{result.lstmRiskLevel}</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                          <div 
                            className="bg-error h-full rounded-full transition-all duration-1000"
                            style={{ width: `${result.lstmRiskScore !== null ? result.lstmRiskScore * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-mono text-secondary mb-1.5">
                          <span>Confidence</span>
                          <span>{result.lstmConfidence !== null ? `${(result.lstmConfidence * 100).toFixed(1)}%` : 'N/A'}</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden border border-white/5">
                          <div 
                            className="bg-white h-full rounded-full transition-all duration-1000"
                            style={{ width: `${result.lstmConfidence !== null ? result.lstmConfidence * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Retrieved Similar Scams (RAG) */}
                <div className="glass-card p-4 border border-white/5">
                  <span className="text-[10px] text-secondary font-mono block mb-2">RETRIEVED SIMILAR SCAMS (RAG)</span>
                  {result.similarScams && result.similarScams.length > 0 ? (
                    <div className="space-y-2 mt-1">
                      {result.similarScams.map((scam: SimilarScam, index: number) => (
                        <div key={index} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                          <div>
                            <p className="text-sm font-medium text-white">{scam.campaign_name}</p>
                            <p className="text-[10px] text-secondary font-mono mt-0.5">Category: {scam.scam_type}</p>
                          </div>
                          <span className="text-xs font-mono text-primary bg-white/10 px-2 py-1 rounded">
                            {(scam.similarity_score * 100).toFixed(1)}% Match
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-secondary font-mono py-1">No active threat campaigns matched in ChromaDB.</p>
                  )}
                </div>

                {/* AI Explanation */}
                <div className="glass-card p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Brain className="w-4 h-4 text-white" />
                    <span className="text-[10px] text-secondary font-mono tracking-wider uppercase">AI Explanation</span>
                  </div>
                  <p className="text-sm text-secondary leading-relaxed bg-[#111111]/45 p-3 rounded-xl border border-white/5">
                    {getAIExplanation(result.scamType, result.riskLevel, result.indicators)}
                  </p>
                </div>

                {/* Recommendations */}
                <div className="glass-card p-4 border border-white/5">
                  <div className="flex items-center gap-2 mb-3 text-primary">
                    <ListChecks className="w-4 h-4 text-white" />
                    <span className="text-[10px] text-secondary font-mono tracking-wider uppercase">Actionable Recommendations</span>
                  </div>
                  <ul className="space-y-2">
                    {getRecommendations(result.scamType).map((rec: string, index: number) => (
                      <li key={index} className="flex items-start gap-2.5 text-xs text-secondary leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Key Threat Indicators */}
                {result.indicators && result.indicators.length > 0 && (
                  <div>
                    <span className="text-[10px] text-secondary font-mono block mb-2">KEY THREAT INDICATORS</span>
                    <div className="flex flex-wrap gap-2">
                      {result.indicators.map((ind: any, i: number) => (
                        <span key={i} className="px-3 py-1 bg-surface border border-white/10 rounded-md text-xs font-mono text-white" title={ind.description}>
                          {ind.type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
