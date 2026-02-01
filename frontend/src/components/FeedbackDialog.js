import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, TrendingUp, AlertTriangle, XCircle } from 'lucide-react';

export function FeedbackDialog({ open, onOpenChange, score, feedback, onContinue }) {
  const getMessage = () => {
    if (score >= 85) return { text: 'Excellent!', icon: <CheckCircle2 className="w-12 h-12 text-emerald-600" />, color: 'text-emerald-600' };
    if (score >= 70) return { text: 'Great Job!', icon: <TrendingUp className="w-12 h-12 text-blue-600" />, color: 'text-blue-600' };
    if (score >= 50) return { text: 'Good Effort!', icon: <AlertTriangle className="w-12 h-12 text-amber-500" />, color: 'text-amber-500' };
    if (score >= 30) return { text: 'Keep Improving!', icon: <AlertTriangle className="w-12 h-12 text-orange-500" />, color: 'text-orange-500' };
    return { text: 'Keep Trying!', icon: <XCircle className="w-12 h-12 text-rose-600" />, color: 'text-rose-600' };
  };

  const msg = getMessage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Answer Feedback</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="flex justify-center mb-4">{msg.icon}</div>
            <h3 className={`text-3xl font-bold mb-2 ${msg.color}`}>{msg.text}</h3>
            <div className="text-5xl font-bold text-slate-900 mb-2">{score.toFixed(1)}<span className="text-2xl text-slate-600">/100</span></div>
          </div>
          
          {feedback && (
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-700 leading-relaxed">{feedback}</p>
            </div>
          )}

          <Button 
            onClick={onContinue} 
            className="w-full bg-blue-800 hover:bg-blue-900 text-white"
            size="lg"
          >
            Continue to Next Question
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}