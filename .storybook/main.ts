import { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  // A clean, open crawler tracking rule to locate future React stories natively
  stories: ['../packages/**/src/**/*.stories.@(ts|tsx|js|jsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  }
};

export default config;
