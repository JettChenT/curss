// User types
export type User = {
  id: number;
  firstName: string;
  lastName: string;
  userLink: string;
  lastOnline: string;
};

export type FollowingUser = {
  id: number;
  firstName: string;
  lastName: string;
  userLink: string;
  lastOnline: string;
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

