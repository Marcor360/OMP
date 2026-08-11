import { render } from '@testing-library/react-native';

import { Chip } from '@/src/components/ui/Chip';

jest.mock(
  '@react-native-async-storage/async-storage',
  () =>
    jest.requireActual(
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
    ),
);

describe('Chip', () => {
  it('renders the provided label', async () => {
    const { getByText } = await render(<Chip label="Asignaciones" />);

    expect(getByText('Asignaciones')).toBeTruthy();
  });
});
