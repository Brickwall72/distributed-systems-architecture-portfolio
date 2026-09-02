// File: .storybook/preview.ts
import type { Preview } from '@storybook/react';
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
