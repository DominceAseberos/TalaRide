import Svg, { Circle, Line, Path, Rect, G } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

export type IllustrationName = 'splash' | 'scan' | 'privacy' | 'community' | 'mark';

export function TalaIllustration({
  name,
  width = 280,
  style,
}: {
  name: IllustrationName;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const height = name === 'splash' ? width * 0.82 : name === 'mark' ? width : width * 0.88;
  if (name === 'mark') return <Mark width={width} />;
  return (
    <Svg width={width} height={height} viewBox="0 0 320 280" style={style}>
      <Rect width="320" height="280" rx="32" fill="#F3F8F1" />
      <Circle cx="42" cy="42" r="22" fill="#DDEFE4" />
      <Circle cx="278" cy="48" r="28" fill="#E7F2E9" />
      {name === 'splash' && <SplashScene />}
      {name === 'scan' && <ScanScene />}
      {name === 'privacy' && <PrivacyScene />}
      {name === 'community' && <CommunityScene />}
    </Svg>
  );
}

function Mark({ width }: { width: number }) {
  return (
    <Svg width={width} height={width} viewBox="0 0 100 100">
      <Path
        d="M50 5c22 0 40 17 40 39 0 24-20 39-40 51C30 83 10 68 10 44 10 22 28 5 50 5Z"
        fill="#00623A"
      />
      <Path
        d="M50 14c17 0 31 13 31 30 0 17-14 29-31 40C33 73 19 61 19 44c0-17 14-30 31-30Z"
        fill="#F4F8F0"
      />
      <Circle cx="38" cy="34" r="8" fill="#F4B41B" />
      <Path
        d="M30 59h42M36 48h33M47 42v17M62 42v17"
        stroke="#00623A"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Path d="M32 48c1-9 8-14 18-14h16c7 0 12 5 13 14" fill="#00844A" />
      <Circle cx="38" cy="61" r="9" fill="#F4F8F0" stroke="#00623A" strokeWidth="4" />
      <Circle cx="68" cy="61" r="9" fill="#F4F8F0" stroke="#00623A" strokeWidth="4" />
    </Svg>
  );
}

function Tricycle({ x = 48, y = 116, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      <Path d="M4 73h196" stroke="#B8CFC1" strokeWidth="4" />
      <Path d="M31 34h111v42H31z" fill="#087348" />
      <Path d="M42 12h89l13 22H31Z" fill="#0A8651" />
      <Path d="M51 15h70v17H51Z" fill="#B7D9C2" />
      <Path d="M40 38h50v36H40z" fill="#153F34" />
      <Path d="M96 39h37v34H96z" fill="#D9EBD9" />
      <Path d="M128 35h19l17 39h-31Z" fill="#0A6841" />
      <Path d="M146 40h22v34h-18Z" fill="#E6F0E5" />
      <Circle cx="55" cy="80" r="15" fill="#F7FAF3" stroke="#123C31" strokeWidth="6" />
      <Circle cx="150" cy="80" r="15" fill="#F7FAF3" stroke="#123C31" strokeWidth="6" />
      <Circle cx="55" cy="80" r="4" fill="#148A58" />
      <Circle cx="150" cy="80" r="4" fill="#148A58" />
      <Rect x="57" y="46" width="31" height="20" rx="3" fill="#FFFDF6" />
      <TextPlate />
      <Path d="M169 49h16" stroke="#F4B41B" strokeWidth="5" strokeLinecap="round" />
    </G>
  );
}

function TextPlate() {
  return (
    <G>
      <Line x1="73" y1="51" x2="73" y2="62" stroke="#123C31" strokeWidth="2" />
      <Line x1="62" y1="56" x2="84" y2="56" stroke="#123C31" strokeWidth="2" />
    </G>
  );
}

function SplashScene() {
  return (
    <G>
      <Path d="M0 214h320v66H0z" fill="#D5E7DA" />
      <Path d="M0 226h320" stroke="#94B7A1" strokeWidth="5" />
      <Path d="M30 214V90h30v124M248 214V72h28v142M88 214v-90h23v90" fill="#B9DDEB" opacity=".7" />
      <Tricycle x={34} y={112} scale={1.17} />
    </G>
  );
}

function ScanScene() {
  return (
    <G>
      <Tricycle x={50} y={112} scale={0.98} />
      <Path d="M222 205c9-20 30-24 43-10 10 11 14 28 9 45l-21 18-25-14Z" fill="#F5B48C" />
      <Path d="M244 200c15-7 27 4 30 18l-18 5-16-11Z" fill="#F8C19B" />
      <Rect
        x="203"
        y="164"
        width="58"
        height="45"
        rx="6"
        fill="#FFFDF8"
        stroke="#173D31"
        strokeWidth="4"
        transform="rotate(-10 203 164)"
      />
      <TextPlate />
    </G>
  );
}

function PrivacyScene() {
  return (
    <G>
      <Path d="M160 62 239 91v63c0 54-35 77-79 96-44-19-79-42-79-96V91Z" fill="#00623A" />
      <Path d="M160 75 222 98v53c0 40-24 59-62 77-38-18-62-37-62-77V98Z" fill="#087A49" />
      <Rect x="124" y="133" width="72" height="60" rx="10" fill="#F6FBF5" />
      <Path
        d="M140 133v-14c0-27 40-27 40 0v14"
        fill="none"
        stroke="#F6FBF5"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <Circle cx="160" cy="161" r="7" fill="#087A49" />
      <Line x1="160" y1="168" x2="160" y2="180" stroke="#087A49" strokeWidth="5" />
    </G>
  );
}

function CommunityScene() {
  return (
    <G>
      <Circle cx="160" cy="110" r="55" fill="#D9ECDF" />
      <Circle cx="115" cy="139" r="25" fill="#F5B48C" />
      <Path d="M77 218c5-50 74-50 79 0Z" fill="#F4B41B" />
      <Circle cx="203" cy="124" r="25" fill="#C9825F" />
      <Path d="M165 218c6-51 75-51 80 0Z" fill="#087348" />
      <Rect
        x="101"
        y="145"
        width="21"
        height="35"
        rx="4"
        fill="#173D31"
        transform="rotate(12 101 145)"
      />
      <Rect
        x="196"
        y="137"
        width="21"
        height="35"
        rx="4"
        fill="#173D31"
        transform="rotate(-10 196 137)"
      />
      <Circle cx="160" cy="48" r="25" fill="#70B877" />
      <Path d="M160 34v22M150 45h20" stroke="#F6FBF5" strokeWidth="5" strokeLinecap="round" />
    </G>
  );
}
