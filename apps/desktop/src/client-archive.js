// Project saved reviews without changing their historical record on disk. A
// portfolio summary cannot safely be reused once some of its clients are hidden.
function projectActiveWeeklyReview(saved, activeClientIds) {
  if (!saved?.report || !Array.isArray(saved.report.clientReviews)) return saved;
  const active = new Set(activeClientIds.map(Number));
  const clientReviews = saved.report.clientReviews.filter((review) => active.has(Number(review.clientId)));
  const excludedClientCount = saved.report.clientReviews.length - clientReviews.length;
  if (!excludedClientCount) return saved;
  return {
    ...saved,
    excludedClientCount,
    report: {
      ...saved.report,
      clientReviews,
      openingSummary: '',
      practicePatterns: []
    }
  };
}

module.exports = { projectActiveWeeklyReview };
