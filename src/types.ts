export type Category = "Fichas" | "Precios" | "Material";

export type DocItem = {
  id: string;
  title: string;
  category: Category;
  url?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  tags?: string[];
  active: boolean;
  minLevel?: number;
  updatedAt?: number | { seconds: number; nanoseconds?: number };
  size?: number;
  mime?: string;
};

export type UserDoc = {
  email: string;
  active: boolean;
  level: number;
  createdAt?: number;
};
