/**
 * ErrorDisplay Tests
 *
 * Tests error card rendering: title, message, retry/close buttons,
 * and callback behavior.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorDisplay } from '../ErrorDisplay';

describe('ErrorDisplay', () => {
  it('renders title', () => {
    const { getByText } = render(
      <ErrorDisplay title="Load Failed" message="Could not load exercise" />,
    );
    expect(getByText('Load Failed')).toBeTruthy();
  });

  it('renders message', () => {
    const { getByText } = render(
      <ErrorDisplay title="Error" message="Something went wrong" />,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('renders warning emoji', () => {
    const { getByText } = render(
      <ErrorDisplay title="Error" message="msg" />,
    );
    expect(getByText('⚠️')).toBeTruthy();
  });

  it('renders Retry button when onRetry is provided', () => {
    const { getByText } = render(
      <ErrorDisplay title="Error" message="msg" onRetry={() => {}} />,
    );
    expect(getByText('Retry')).toBeTruthy();
  });

  it('hides Retry button when onRetry is not provided', () => {
    const { queryByText } = render(
      <ErrorDisplay title="Error" message="msg" />,
    );
    expect(queryByText('Retry')).toBeNull();
  });

  it('renders Close button when onClose is provided', () => {
    const { getByText } = render(
      <ErrorDisplay title="Error" message="msg" onClose={() => {}} />,
    );
    expect(getByText('Close')).toBeTruthy();
  });

  it('hides Close button when onClose is not provided', () => {
    const { queryByText } = render(
      <ErrorDisplay title="Error" message="msg" />,
    );
    expect(queryByText('Close')).toBeNull();
  });

  it('calls onRetry when Retry is pressed', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <ErrorDisplay title="Error" message="msg" onRetry={onRetry} />,
    );
    fireEvent.press(getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Close is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <ErrorDisplay title="Error" message="msg" onClose={onClose} />,
    );
    fireEvent.press(getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders both buttons simultaneously', () => {
    const { getByText } = render(
      <ErrorDisplay title="Error" message="msg" onRetry={() => {}} onClose={() => {}} />,
    );
    expect(getByText('Retry')).toBeTruthy();
    expect(getByText('Close')).toBeTruthy();
  });

  it('renders testID and child testIDs', () => {
    const { getByTestId } = render(
      <ErrorDisplay
        title="Error"
        message="msg"
        onRetry={() => {}}
        onClose={() => {}}
        testID="err"
      />,
    );
    expect(getByTestId('err')).toBeTruthy();
    expect(getByTestId('err-retry')).toBeTruthy();
    expect(getByTestId('err-close')).toBeTruthy();
  });
});
