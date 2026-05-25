const AISummaryPanel = ({ opportunities, userProfile }) => {
  const topOpp = opportunities[0];
  if (!topOpp?.ai_explanation) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100 p-4 md:p-6 mb-6 md:mb-8">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
          <span className="text-xl">🧠</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-blue-900 mb-1">AI Intelligence Summary</h3>
          <p className="text-sm text-blue-800 leading-relaxed">
            {topOpp.ai_explanation.summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-xs bg-white/70 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200 font-medium">
              🎯 {topOpp.title}
            </span>
            <span className="text-xs bg-white/70 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200 font-medium">
              📈 Score: {topOpp.score}/100
            </span>
            <span className="text-xs bg-white/70 text-green-700 px-2.5 py-1 rounded-full border border-green-200 font-medium">
              💰 {topOpp.income_probability?.level} Probability
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISummaryPanel;