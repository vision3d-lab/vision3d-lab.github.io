function showPendingCitation() {
  const citation = document.getElementById('citation-placeholder');
  if (citation) {
    citation.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
