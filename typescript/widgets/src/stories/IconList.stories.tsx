import { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import * as Hyperlane from '../index';

interface StoryIconProps {
  width?: number;
  height?: number;
  color?: string;
  direction?: 'n' | 'e' | 's' | 'w';
  rounded?: boolean;
}

const excludedComponents = ['IconButton', 'EllipsisIcon'];

const iconList = Object.entries(Hyperlane)
  .filter(
    ([name]) => name.includes('Icon') && !excludedComponents.includes(name),
  )
  .map(([_, Component]) => Component as React.ComponentType<StoryIconProps>);

function IconList({
  width,
  height,
  color,
  direction,
  bgColorSeed,
  roundedWideChevron,
  ellipsisDirection,
}: {
  width: number;
  height: number;
  color: string;
  direction: 'n' | 'e' | 's' | 'w';
  bgColorSeed: number | undefined;
  roundedWideChevron: boolean;
  ellipsisDirection: 'vertical' | 'horizontal';
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          textAlign: 'center',
          flexWrap: 'wrap',
        }}
      >
        {iconList.map((Icon, index) => (
          <IconContainer key={index}>
            <span>{Icon.displayName}</span>
            <Icon
              width={width}
              height={height}
              color={color}
              direction={direction}
              rounded={roundedWideChevron}
            />
          </IconContainer>
        ))}
        <IconContainer>
          <span>EllipsisIcon</span>
          <Hyperlane.EllipsisIcon
            width={width}
            height={height}
            direction={ellipsisDirection}
            color={color}
          />
        </IconContainer>
        <IconContainer>
          <span>Circle</span>
          <Hyperlane.Circle size={width} bgColorSeed={bgColorSeed} />
        </IconContainer>
      </div>
    </>
  );
}

function IconContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'center',
        width: '120px',
      }}
    >
      {children}
    </div>
  );
}

const meta = {
  title: 'Icon List',
  component: IconList,
  argTypes: {
    direction: {
      options: ['n', 'e', 's', 'w'],
      control: { type: 'select' },
    },
    ellipsisDirection: {
      options: ['horizontal', 'vertical'],
      control: { type: 'select' },
    },
  },
} satisfies Meta<typeof IconList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultIconList = {
  args: {
    width: 24,
    height: 24,
    color: Hyperlane.ColorPalette.Black,
    direction: 's',
    bgColorSeed: 0,
    roundedWideChevron: false,
    ellipsisDirection: 'horizontal',
  },
} satisfies Story;
