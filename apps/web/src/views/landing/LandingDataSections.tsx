import { doctorsService } from '@/services/doctors/doctorsService';
import { specialtiesService } from '@/services/specialties/specialtiesService';
import type { PublicDoctor, SpecialtySelection } from '@/types/doctors';

import { SpecialtiesSection, SpecialistsSection } from './CatalogSections';
import type { CatalogState } from './CatalogSections';

export async function SpecialtiesDataSection() {
  let state: CatalogState<SpecialtySelection>;
  try {
    const result = await specialtiesService.publicPage({ page: 1, limit: 8 });
    state = { status: 'ready', items: result.data };
  } catch {
    state = { status: 'error' };
  }
  return <SpecialtiesSection state={state} />;
}

export async function SpecialistsDataSection() {
  let state: CatalogState<PublicDoctor>;
  try {
    const result = await doctorsService.publicPage({ page: 1, limit: 6 });
    state = { status: 'ready', items: result.data };
  } catch {
    state = { status: 'error' };
  }
  return <SpecialistsSection state={state} />;
}
