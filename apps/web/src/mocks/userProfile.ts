export type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  country?: string;
  avatarInitials: string;
};

export const mockUserProfile: UserProfile = {
  id: 'user_1',
  firstName: 'João',
  lastName: 'Silva',
  email: 'joao.silva@email.com',
  phone: '+351 912 345 678',
  city: 'Lisboa',
  country: 'Portugal',
  avatarInitials: 'JS',
};

export default mockUserProfile;
