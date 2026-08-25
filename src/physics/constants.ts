export const BALL_RADIUS = 0.0305;
export const BALL_MASS = 0.21;
export const CUE_MASS = 0.55;
export const G = 9.81;
export const BALL_INERTIA = (2 / 5) * BALL_MASS * BALL_RADIUS * BALL_RADIUS;

export const PLAY_W = 2.84;
export const PLAY_H = 1.42;

export const CUSHION_NOSE_HEIGHT = 1.25 * BALL_RADIUS;
export const CUSHION_HEIGHT_OFFSET = 0.25 * BALL_RADIUS;
export const CUSHION_REACH = Math.sqrt(
  BALL_RADIUS * BALL_RADIUS - CUSHION_HEIGHT_OFFSET * CUSHION_HEIGHT_OFFSET,
);
export const CUSHION_DYN_ARM = 0.05 * BALL_RADIUS;

export const E_BALL_BALL = 0.95;
export const E_CUSHION = 0.85;

export const MU_SLIDE = 0.2;
export const MU_ROLL = 0.01;
export const MU_SPIN = 0.044;
export const MU_THROW = 0.06;
export const MU_CUSHION = 0.2;

export const SLIDE_EPS = 1e-4;
export const STOP_SPEED_EPS = 0.005;
export const SPIN_STOP_EPS = 0.02;
export const MAX_SUBSTEP = 0.002;
export const POSITION_SLOP = 1e-7;
export const MAX_EVENTS_PER_STEP = 64;

export const MAX_ELEVATION = Math.PI / 3;
export const MIN_ELEVATION = 0;
