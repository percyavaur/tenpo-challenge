export interface IAuthor {
  name: string;
  key: string;
}

export interface IBook {
  key: string;
  title: string;
  edition_count: number;
  authors: IAuthor[];
  has_fulltext: boolean;
  ia?: string;
}

export interface ISubjectResponse {
  work_count: number;
  works: IBook[];
}
