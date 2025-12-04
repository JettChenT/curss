// User types
export type ProfileMetadata = {
  major?: string | null;
  interests?: string | null;
  expertise?: string | null;
  school?: string | null;
  github?: string | null;
  twitter?: string | null;
  website?: string | null;
} | null;

export type User = {
  id: number;
  firstName: string;
  lastName: string;
  userLink: string;
  lastOnline: string;
  numFollowers: number;
  profileMetadata?: ProfileMetadata;
};

export type FollowingUser = {
  id: number;
  firstName: string;
  lastName: string;
  userLink: string;
  lastOnline: string;
  numFollowers: number;
};

export type FollowWithOrder = {
  followingUser: FollowingUser;
  order: number;
};

// Content/Feed types
export type Content = {
  id: number;
  link: string;
  title: string;
  favorite: boolean;
  snippet: string | null;
  toRead: boolean | null;
  createdBy: number | null;
  createdDate: string;
  modifiedDate: string;
  lastCrawled: string | null;
  metadata: unknown;
  highlights: unknown[];
  userIds: number[] | null;
  savedBy: FollowWithOrder[] | null;
};

// API Response types
export type AllUsersResponse = {
  users: User[];
};
