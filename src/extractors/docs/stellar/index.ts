export interface DocSummary {
  description: string;
  annotations: Record<string, string>;
}

export class DocumentationExtractor {
  extract(sourceCode: string): DocSummary {
    return {
      description: "Extracted documentation",
      annotations: {}
    };
  }
}
