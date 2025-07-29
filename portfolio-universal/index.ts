// Fix for propTypes issue with React Native 0.79+
import PropTypes from 'prop-types';
import { registerRootComponent } from 'expo';

// Polyfill propTypes for components that still use it
if (!global.React) {
  global.React = require('react');
}
if (!global.React.PropTypes) {
  global.React.PropTypes = PropTypes;
}

import App from './App';

registerRootComponent(App);