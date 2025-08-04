// Fix for propTypes issue with React Native 0.79+
import PropTypes from 'prop-types';
import { registerRootComponent } from 'expo';

// Polyfill propTypes for components that still use it
if (!(global as any).React) {
  (global as any).React = require('react');
}
if (!(global as any).React.PropTypes) {
  (global as any).React.PropTypes = PropTypes;
}

import App from './App';

registerRootComponent(App);