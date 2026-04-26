export type PlanId = 'free' | 'pro' | 'premium';
export type BillingPeriod = 'monthly' | 'annual';

export type UserSubscription = {
  planId: PlanId;
  billingPeriod: BillingPeriod;
  status: 'active' | 'trialing' | 'canceled';
};

export type UserProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  country?: string;
  avatarInitials: string;
  plan: PlanId;
};

export const emptyUserProfile: UserProfile = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  avatarInitials: '',
  plan: 'free',
};

export const userProfile: UserProfile = emptyUserProfile;

export const mockUserProfile: UserProfile = {
  id: 'user_1',
  firstName: 'João',
  lastName: 'Silva',
  email: 'joao.silva@email.com',
  phone: '+351 912 345 678',
  city: 'Lisboa',
  country: 'Portugal',
  avatarInitials: 'JS',
  plan: 'free',
};

export default emptyUserProfile;
