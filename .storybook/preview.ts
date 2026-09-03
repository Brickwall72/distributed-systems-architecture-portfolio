// File: .storybook/preview.ts
import type { Preview } from '@storybook/react';
import { mswLoader } from 'msw-storybook-addon/csf3';
import '../packages/styles/src/global.css'; // Registers the master Tailwind layers globally into the preview container

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  loaders: [
    mswLoader()
  ],
};

export default preview;
