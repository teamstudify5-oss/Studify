import { Paper } from '../types';

/**
 * Service to generate and inject educational Schema.org structured data (JSON-LD)
 * for Previous Year Question papers to optimize discoverability on Google.
 */
export const injectEducationalStructuredData = (papers: Paper[]): void => {
  try {
    const existingScript = document.getElementById('studify-schema-jsonld');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'studify-schema-jsonld';
    script.type = 'application/ld+json';

    const itemListElement = papers.slice(0, 15).map((paper, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'LearningResource',
        name: `${paper.subject} ${paper.year} (${paper.examBoard}) Previous Year Question Paper`,
        description: `Official previous year question paper for ${paper.subject}, ${paper.examBoard} examination held in ${paper.year}. Free student download and preview.`,
        educationalLevel: paper.grade,
        learningResourceType: 'Assessment / Exam Paper',
        educationalAlignment: {
          '@type': 'AlignmentObject',
          alignmentType: 'educationalSubject',
          targetName: paper.subject,
        },
        inLanguage: 'en',
        url: window.location.origin,
      },
    }));

    const schemaData = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'Studify',
          url: window.location.origin,
          description: 'A focused, modern dark workspace to discover, read, and practice previous year question papers.',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${window.location.origin}/?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'ItemList',
          name: 'Verified Previous Year Question Papers (PYQs)',
          itemListElement,
        },
      ],
    };

    script.textContent = JSON.stringify(schemaData, null, 2);
    document.head.appendChild(script);
  } catch (err) {
    console.error('Failed to inject Schema.org structured data', err);
  }
};

/**
 * Checks meta elements and verifies Google Search compliance
 */
export const inspectPageSeoMetadata = () => {
  const title = document.title;
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
  const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
  const hasJsonLd = !!document.getElementById('studify-schema-jsonld');

  return {
    titleLength: title.length,
    isTitleValid: title.length >= 25 && title.length <= 70,
    descLength: metaDesc.length,
    isDescValid: metaDesc.length >= 70 && metaDesc.length <= 160,
    hasOgTags: !!(ogTitle && ogDesc),
    hasViewport: !!viewport,
    hasJsonLd,
  };
};
