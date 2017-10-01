import { JSDOM } from 'jsdom';
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({ adapter: new Adapter() });

const { window } = new JSDOM('', {
  userAgent: 'node.js',
});

Object.keys(window).forEach(property => {
  if (typeof global[property] === 'undefined') {
    global[property] = window[property];
  }
});

require.extensions['.svg'] = (mod, fn) => {
  mod.exports = '/packs/' + fn.replace(/.*\//, '');
};
require.extensions['.png'] = (mod, fn) => {
  mod.exports = '/packs/' + fn.replace(/.*\//, '');
};
