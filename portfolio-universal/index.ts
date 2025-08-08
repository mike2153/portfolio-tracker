// Fix for propTypes issue with React Native 0.79+
import { registerRootComponent } from 'expo';

// Polyfill propTypes for components that still use it (development only)
if (__DEV__) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PropTypes = require('prop-types');
  if (!(global as any).React) {
    (global as any).React = require('react');
  }
  if (!(global as any).React.PropTypes) {
    (global as any).React.PropTypes = PropTypes;
  }
}

import App from './App';

registerRootComponent(App);