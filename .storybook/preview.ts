// File: .storybook/preview.ts
import type { Preview } from '@storybook/react';
// @ts-expect-error Storybook/Vite loads this stylesheet at runtime; TypeScript has no CSS module declaration.
import './global.css'; // Registers the master Tailwind layers globally into the preview container

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
