'use client';

// Third-party Imports
import classnames from 'classnames';

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses';

const FooterContent = () => {
  return (
    <div
      className={classnames(verticalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      Recuerda cambiar el footer
    </div>
  );
};

export default FooterContent;
