// MUI Imports
import { useTheme } from '@mui/material/styles';

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar';

// Type Imports
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu';

// Component Imports
import { useAuth } from '@/components/auth/AuthGuard';
import { Menu, MenuItem } from '@menu/vertical-menu';

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav';

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon';

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles';
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles';

type RenderExpandIconProps = {
  open?: boolean;
  transitionDuration?: VerticalMenuContextProps['transitionDuration'];
};

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
);

const VerticalMenu = ({ scrollMenu }: { scrollMenu: (container: any, isPerfectScrollbar: boolean) => void }) => {
  // Hooks
  const theme = useTheme();
  const { hasPermission } = useAuth();
  const { isBreakpointReached, transitionDuration } = useVerticalNav();

  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar;

  return (
    /* Custom scrollbar instead of browser scroll, remove if you want browser scroll only */
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',
            onScroll: (container) => scrollMenu(container, false),
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: (container) => scrollMenu(container, true),
          })}
    >
      {/* Incase you also want to scroll NavHeader to scroll with Vertical Menu, remove NavHeader from above and paste it below this comment */}
      {/* Vertical Menu */}
      <Menu
        menuItemStyles={menuItemStyles(theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuSectionStyles={menuSectionStyles(theme)}
      >
        {hasPermission('schedule.get-availability') && hasPermission('doctor.get-by-specialty') && (
          <MenuItem href='/dashboard/schedules/availability' icon={<i className='ri-calendar-check-line' />}>
            Disponibilidad médica
          </MenuItem>
        )}
        {hasPermission('appointment.create-for-patient') && (
          <MenuItem href='/dashboard/appointments/reception' icon={<i className='ri-calendar-event-line' />}>
            Reservar desde recepción
          </MenuItem>
        )}
        {hasPermission('appointment.get-agenda') && (
          <MenuItem href='/dashboard/appointments/agenda' icon={<i className='ri-calendar-todo-line' />}>
            Mi agenda médica
          </MenuItem>
        )}
        {hasPermission('appointment.get-mine') && (
          <MenuItem href='/dashboard/appointments' icon={<i className='ri-calendar-event-line' />}>
            Mis citas
          </MenuItem>
        )}
        {hasPermission('schedule.update') && (
          <MenuItem href='/dashboard/schedules' icon={<i className='ri-calendar-2-line' />}>
            Mis horarios
          </MenuItem>
        )}
        {hasPermission('schedule.create') && (
          <MenuItem href='/dashboard/schedules/register' icon={<i className='ri-calendar-line' />}>
            Registrar mi horario
          </MenuItem>
        )}
        {hasPermission('doctor.get-all') && (
          <MenuItem href='/dashboard/doctors' icon={<i className='ri-stethoscope-line' />}>
            Médicos
          </MenuItem>
        )}
        {hasPermission('doctor.get-by-specialty') && (
          <MenuItem href='/dashboard/doctors/by-specialty' icon={<i className='ri-search-line' />}>
            Médicos por especialidad
          </MenuItem>
        )}
        {hasPermission('doctor.create') && (
          <MenuItem href='/dashboard/doctors/register' icon={<i className='ri-user-add-line' />}>
            Registrar médico
          </MenuItem>
        )}
        {hasPermission('specialty.get-all') && (
          <MenuItem href='/dashboard/specialties' icon={<i className='ri-heart-pulse-line' />}>
            Especialidades
          </MenuItem>
        )}
        {hasPermission('user.get-all') && (
          <MenuItem href='/dashboard/users' icon={<i className='ri-group-line' />}>
            Usuarios
          </MenuItem>
        )}
        {hasPermission('user.create-patient') && (
          <MenuItem href='/dashboard/patients/register' icon={<i className='ri-user-add-line' />}>
            Registrar paciente
          </MenuItem>
        )}
        {hasPermission('role.get-all') && (
          <MenuItem href='/dashboard/roles' icon={<i className='ri-shield-user-line' />}>
            Roles
          </MenuItem>
        )}
        {['role.get-all', 'role.get-one-by-id', 'permission.get-all'].every(hasPermission) && (
          <MenuItem href='/dashboard/roles/permissions' icon={<i className='ri-key-2-line' />}>
            Permisos por rol
          </MenuItem>
        )}
      </Menu>
    </ScrollWrapper>
  );
};

export default VerticalMenu;
