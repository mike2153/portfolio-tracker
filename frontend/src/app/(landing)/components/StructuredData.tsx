interface StructuredDataProps {
  metadata?: {
    title?: string;
    description?: string;
    url?: string;
  };
}

export const StructuredData = ({ metadata }: StructuredDataProps = {}) => {
  const defaultMetadata = {
    title: "Portfolio Tracker - Investment Portfolio Management & Analytics",
    description: "Advanced portfolio tracking software with real-time analytics, performance metrics, and risk assessment tools for investment management.",
    url: "https://portfoliotracker.com"
  };

  const finalMetadata = { ...defaultMetadata, ...metadata };

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "name": "Portfolio Tracker",
        "applicationCategory": "FinanceApplication",
        "operatingSystem": ["Web Browser", "iOS", "Android"],
        "description": finalMetadata.description,
        "url": finalMetadata.url,
        "author": {
          "@type": "Organization",
          "name": "Portfolio Tracker Team"
        },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock",
          "priceValidUntil": "2025-12-31"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "reviewCount": "150",
          "bestRating": "5",
          "worstRating": "1"
        },
        "featureList": [
          "Real-time portfolio tracking",
          "Performance analytics and risk assessment", 
          "Asset allocation analysis",
          "Historical data visualization",
          "Professional financial metrics calculation",
          "Multi-account portfolio consolidation",
          "Bank-level security encryption"
        ],
        "screenshot": `${finalMetadata.url}/images/portfolio-dashboard-screenshot.jpg`,
        "softwareVersion": "2.0",
        "datePublished": "2024-01-01",
        "dateModified": new Date().toISOString().split('T')[0]
      },
      {
        "@type": "Organization",
        "name": "Portfolio Tracker",
        "url": finalMetadata.url,
        "logo": `${finalMetadata.url}/logo.png`,
        "sameAs": [
          "https://twitter.com/portfoliotracker",
          "https://linkedin.com/company/portfoliotracker"
        ],
        "contactPoint": {
          "@type": "ContactPoint",
          "contactType": "customer service",
          "email": "support@portfoliotracker.com"
        }
      },
      {
        "@type": "WebSite",
        "name": finalMetadata.title,
        "url": finalMetadata.url,
        "description": finalMetadata.description,
        "publisher": {
          "@type": "Organization",
          "name": "Portfolio Tracker"
        },
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${finalMetadata.url}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How secure is my financial data?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "We use bank-level encryption and never store your login credentials. All data is encrypted in transit and at rest with SOC 2 compliance."
            }
          },
          {
            "@type": "Question", 
            "name": "What investment accounts can I connect?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Portfolio Tracker supports 12,000+ financial institutions including major brokerages, banks, and investment platforms."
            }
          },
          {
            "@type": "Question",
            "name": "Is Portfolio Tracker free to use?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes, we offer a free 14-day trial with full access to all premium features. No credit card required to start."
            }
          }
        ]
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};