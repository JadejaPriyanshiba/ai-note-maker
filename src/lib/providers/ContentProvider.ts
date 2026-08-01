import { LearningContent, LearningSessionFilter } from "../../types";

export interface ContentProviderOptions {
  limit?: number;
  filters?: Partial<LearningSessionFilter>;
}

export interface ContentProvider {
  readonly name: string;
  search(keyword: string, options?: ContentProviderOptions): Promise<LearningContent[]>;
}

// Registry for current & future providers (YouTube, Instagram, Pinterest, etc.)
class ContentProviderRegistry {
  private providers: Map<string, ContentProvider> = new Map();
  private defaultProviderName: string = "youtube";

  register(provider: ContentProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name?: string): ContentProvider {
    const providerName = name || this.defaultProviderName;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Content provider "${providerName}" is not registered.`);
    }
    return provider;
  }

  getAll(): ContentProvider[] {
    return Array.from(this.providers.values());
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Cannot set default to unregistered provider "${name}".`);
    }
    this.defaultProviderName = name;
  }
}

export const providerRegistry = new ContentProviderRegistry();
