'use client';

// React Imports
import { forwardRef, useEffect, useRef } from 'react';
import type { AnchorHTMLAttributes, ForwardRefRenderFunction, ReactElement, ReactNode } from 'react';

// Next Imports
import { usePathname } from 'next/navigation';

// Third-party Imports
import classnames from 'classnames';
import type { CSSObject } from '@emotion/styled';

// Type Imports
import type { ChildrenType, MenuItemElement, MenuItemExactMatchUrlProps, RootStylesType } from '../../types';

// Component Imports
import MenuButton from './MenuButton';

// Hook Imports
import useVerticalNav from '../../hooks/useVerticalNav';
import useVerticalMenu from '../../hooks/useVerticalMenu';

// Util Imports
import { renderMenuIcon } from '../../utils/menuUtils';
import { menuClasses } from '../../utils/menuClasses';

// Styled Component Imports
import StyledMenuLabel from '../../styles/StyledMenuLabel';
import StyledMenuPrefix from '../../styles/StyledMenuPrefix';
import StyledMenuSuffix from '../../styles/StyledMenuSuffix';
import StyledVerticalMenuItem from '../../styles/vertical/StyledVerticalMenuItem';

export type MenuItemProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'prefix'> &
  RootStylesType &
  Partial<ChildrenType> &
  MenuItemExactMatchUrlProps & {
    icon?: ReactElement;
    prefix?: ReactNode;
    suffix?: ReactNode;
    disabled?: boolean;
    target?: string;
    rel?: string;
    onActiveChange?: (active: boolean) => void;

    /**
     * @ignore
     */
    level?: number;
  };

const MenuItem: ForwardRefRenderFunction<HTMLLIElement, MenuItemProps> = (props, ref) => {
  // Props
  const {
    children,
    icon,
    className,
    prefix,
    suffix,
    level = 0,
    disabled = false,
    exactMatch = true,
    activeUrl,
    onActiveChange,
    rootStyles,
    ...rest
  } = props;

  // Hooks
  const pathname = usePathname();
  const active = Boolean(
    rest.href && (exactMatch ? pathname === rest.href : activeUrl && pathname.includes(activeUrl)),
  );
  const previousActive = useRef(false);
  const { menuItemStyles, renderExpandedMenuItemIcon, textTruncate } = useVerticalMenu();

  const { toggleVerticalNav, isToggled, isBreakpointReached } = useVerticalNav();

  // Get the styles for the specified element.
  const getMenuItemStyles = (element: MenuItemElement): CSSObject | undefined => {
    // If the menuItemStyles prop is provided, get the styles for the specified element.
    if (menuItemStyles) {
      // Define the parameters that are passed to the style functions.
      const params = { level, disabled, active, isSubmenu: false };

      // Get the style function for the specified element.
      const styleFunction = menuItemStyles[element];

      if (styleFunction) {
        // If the style function is a function, call it and return the result.
        // Otherwise, return the style function itself.
        return typeof styleFunction === 'function' ? styleFunction(params) : styleFunction;
      }
    }
  };

  // Handle the click event.
  const handleClick = () => {
    if (isToggled) {
      toggleVerticalNav();
    }
  };

  // Call the onActiveChange callback when the active state changes.
  useEffect(() => {
    if (previousActive.current !== active) {
      onActiveChange?.(active);
      previousActive.current = active;
    }
  }, [active, onActiveChange]);

  return (
    <StyledVerticalMenuItem
      ref={ref}
      className={classnames(
        menuClasses.menuItemRoot,
        { [menuClasses.disabled]: disabled },
        { [menuClasses.active]: active },
        className,
      )}
      level={level}
      disabled={disabled}
      buttonStyles={getMenuItemStyles('button')}
      menuItemStyles={getMenuItemStyles('root')}
      rootStyles={rootStyles}
    >
      <MenuButton
        className={classnames(menuClasses.button, { [menuClasses.active]: active })}
        tabIndex={disabled ? -1 : 0}
        {...rest}
        onClick={(e) => {
          handleClick();

          if (rest.onClick) rest.onClick(e);
        }}
      >
        {/* Menu Item Icon */}
        {renderMenuIcon({
          icon,
          level,
          active,
          disabled,
          renderExpandedMenuItemIcon,
          styles: getMenuItemStyles('icon'),
          isBreakpointReached,
        })}

        {/* Menu Item Prefix */}
        {prefix && (
          <StyledMenuPrefix className={menuClasses.prefix} rootStyles={getMenuItemStyles('prefix')}>
            {prefix}
          </StyledMenuPrefix>
        )}

        {/* Menu Item Label */}
        <StyledMenuLabel
          className={menuClasses.label}
          rootStyles={getMenuItemStyles('label')}
          textTruncate={textTruncate}
        >
          {children}
        </StyledMenuLabel>

        {/* Menu Item Suffix */}
        {suffix && (
          <StyledMenuSuffix className={menuClasses.suffix} rootStyles={getMenuItemStyles('suffix')}>
            {suffix}
          </StyledMenuSuffix>
        )}
      </MenuButton>
    </StyledVerticalMenuItem>
  );
};

export default forwardRef(MenuItem);
