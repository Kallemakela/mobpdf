/**
 * Custom Jest environment that sets up TextEncoder/TextDecoder before jsdom
 */

import { TextEncoder, TextDecoder } from 'util';
import Environment from 'jest-environment-jsdom';

export default class CustomEnvironment extends Environment {
  constructor(config, context) {
    super(config, context);
    
    // Set up TextEncoder/TextDecoder globally
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
  }
}

