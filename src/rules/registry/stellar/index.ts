export interface RuleMetadata {
  id: string;
  name: string;
}

export class AutoRegistry {
  private rules: RuleMetadata[] = [];

  discover(): void {
    // Autodiscover
  }

  validateMetadata(metadata: RuleMetadata): boolean {
    return !!metadata.id && !!metadata.name;
  }

  register(metadata: RuleMetadata): void {
    if (this.validateMetadata(metadata)) {
      this.rules.push(metadata);
    }
  }
}
