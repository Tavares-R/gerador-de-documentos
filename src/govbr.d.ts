// src/govbr.d.ts
import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'br-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        primary?: boolean;
        secondary?: boolean;
        block?: boolean;
        loading?: boolean;
        class?: string;
        'trigger-icon'?: string;
      };
      'br-input': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        label?: string;
        placeholder?: string;
        'trigger-icon'?: string;
        maxlength?: string;
      };
      'br-card': any;
      'br-card-header': any;
      'br-card-content': any;
      'br-item': any;
      'br-list': any;
      'br-divider': any;
      'br-tag': any;
      // Adicione outras tags se precisar
      [elemName: string]: any;
    }
  }
}
