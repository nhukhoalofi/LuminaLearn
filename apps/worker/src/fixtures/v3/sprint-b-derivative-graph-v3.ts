import { adaptScalarFunctionGraphV3 } from '@luminalearn/animation';

export const sprintBDerivativeGraphFixtureV3 = adaptScalarFunctionGraphV3({
  kind: 'scalar_function_1d',
  functionType: 'polynomial',
  expression: 'x^2',
  xRange: [-2, 3],
  yRange: [-1, 9],
  pointX: 1,
  tangentAtX: 1,
  secantFromX: 1,
  secantToX: 2.25,
  claimId: 'claim_derivative_x_squared',
  validation: 'formally_verified'
}, 'sprint_b_derivative_graph');

