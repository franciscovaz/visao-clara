import { supabase } from '../../lib/supabase/client';
import { OnboardingData } from '../store/appContextStore';

export class ProfileService {
  /**
   * Check if a profile already exists for authenticated user
   */
  static async checkProfileExists(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = "not found"
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking profile existence:', error);
      throw error;
    }
  }

  /**
   * Check if user already has a tenant
   */
  static async checkUserHasTenant(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking user tenant:', error);
      throw error;
    }
  }

  /**
   * Create complete tenant structure for new user with onboarding data
   */
  static async createTenantStructure(onboardingData: OnboardingData): Promise<{ tenantId: string; projectId: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      console.log('🏗️ Creating tenant structure for user:', user.id);

      // 1. Create tenant
      const tenantName = onboardingData.projectDescription || 
        (onboardingData.projectType === 'new-construction' ? 'Nova Construção' :
         onboardingData.projectType === 'renovation' ? 'Renovação' :
         onboardingData.projectType === 'purchase-with-works' ? 'Compra + Obras' :
         onboardingData.projectType === 'investment' ? 'Investimento' : 'Minha Obra');

      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: tenantName,
          owner_user_id: user.id,
        })
        .select('id')
        .single();

      if (tenantError) throw tenantError;
      const tenantId = tenantData.id;
      console.log('✅ Tenant created:', tenantId);

      // 2. Create tenant membership (owner role)
      const { error: memberError } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;
      console.log('✅ Tenant membership created');

      // 3. Create initial project
      const projectName = onboardingData.projectDescription || 
        (onboardingData.projectType === 'new-construction' ? 'Nova Construção' :
         onboardingData.projectType === 'renovation' ? 'Renovação' :
         onboardingData.projectType === 'purchase-with-works' ? 'Compra + Obras' :
         onboardingData.projectType === 'investment' ? 'Investimento' : 'Projeto Inicial');

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          tenant_id: tenantId,
          name: projectName,
          status: 'active',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (projectError) throw projectError;
      const projectId = projectData.id;
      console.log('✅ Initial project created:', projectId);

      return { tenantId, projectId };
    } catch (error) {
      console.error('Error creating tenant structure:', error);
      throw error;
    }
  }

  /**
   * Complete onboarding flow: create profile + tenant structure
   */
  static async completeOnboarding(onboardingData: OnboardingData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      console.log('🎯 Starting complete onboarding flow for user:', user.id);

      // Check if user already has a tenant (avoid duplicates)
      const hasTenant = await this.checkUserHasTenant();
      if (hasTenant) {
        console.log('ℹ️ User already has tenant, skipping tenant creation');
        
        // Just update profile with onboarding data
        await this.updateProfileWithOnboarding(onboardingData);
        return;
      }

      // 1. Create or update profile
      const profileExists = await this.checkProfileExists();
      
      const profileData = {
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilizador',
        project_type: onboardingData.projectType,
        project_description: onboardingData.projectDescription || null,
        property_type: onboardingData.propertyType,
        property_description: onboardingData.propertyDescription || null,
        current_phase: onboardingData.currentPhase,
        goal: onboardingData.goal,
        budget: onboardingData.budget || null,
        onboarding_completed_at: new Date().toISOString(),
      };

      if (profileExists) {
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', user.id);

        if (error) throw error;
        console.log('✅ Profile updated with onboarding data');
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert(profileData);

        if (error) throw error;
        console.log('✅ Profile created with onboarding data');
      }

      // 2. Create tenant structure
      const { tenantId, projectId } = await this.createTenantStructure(onboardingData);
      
      // 3. Update app context with new tenant/project
      // This will be handled by the caller after successful completion
      
      console.log('🎉 Complete onboarding flow finished successfully');
    } catch (error) {
      console.error('Error in complete onboarding flow:', error);
      throw error;
    }
  }

  /**
   * Update profile with onboarding data (for users who already have tenant)
   */
  static async updateProfileWithOnboarding(onboardingData: OnboardingData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('profiles')
        .update({
          project_type: onboardingData.projectType,
          project_description: onboardingData.projectDescription || null,
          property_type: onboardingData.propertyType,
          property_description: onboardingData.propertyDescription || null,
          current_phase: onboardingData.currentPhase,
          goal: onboardingData.goal,
          budget: onboardingData.budget || null,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      console.log('✅ Profile updated with onboarding data');
    } catch (error) {
      console.error('Error updating profile with onboarding:', error);
      throw error;
    }
  }

  /**
   * Get profile data for authenticated user
   */
  static async getProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }
}
