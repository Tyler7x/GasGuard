export interface SourceLocation {
  line: number;
  column: number;
}

export class SourceMappingEngine {
  resolveLocation(nodeId: string): SourceLocation {
    return { line: 1, column: 1 };
  }

  linkFinding(findingId: string, location: SourceLocation): void {
    // Linked
  }
}
