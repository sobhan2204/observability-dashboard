import 'reflect-metadata';
import { container } from 'tsyringe';
import { DeterministicAnalyzer } from './DeterministicAnalyzer';
import { LLMAnalyzer } from './LLMAnalyzer';

// Register the analyzer. Switch to LLMAnalyzer if needed.
container.register('AIAnalyzer', {
  useClass: DeterministicAnalyzer,
});

export { container };
