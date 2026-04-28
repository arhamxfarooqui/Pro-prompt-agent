export interface Snippet {
  id?: number;
  prefix: string;
  description: string;
  body: string;
  profileId?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SnippetMenuItem {
  id: number;
  prefix: string;
  description: string;
  bodyPreview: string;
}
