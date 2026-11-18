import { fireEvent, render } from '@testing-library/react-native';

import { DatePickerModal } from '@/src/components/forms/DatePickerModal';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

it('names date controls and exposes the selected and unavailable dates', async () => {
  const select = jest.fn();
  const close = jest.fn();
  const { getByRole } = await render(
    <DatePickerModal
      visible
      selectedDate="2027-01-12"
      minDate="2027-01-10"
      maxDate="2027-02-01"
      onSelectDate={select}
      onClose={close}
    />
  );

  expect(getByRole('button', { name: 'Mes anterior', disabled: true })).toBeTruthy();
  expect(getByRole('button', { name: 'Mes siguiente', disabled: false })).toBeTruthy();
  expect(getByRole('button', { name: 'Cerrar' })).toBeTruthy();
  const selected = getByRole('button', { name: /\b12\b.*2027/, selected: true });
  expect(getByRole('button', { name: /\b9\b.*2027/, disabled: true })).toBeTruthy();

  await fireEvent.press(selected);
  expect(select).toHaveBeenCalledWith('2027-01-12');
  expect(close).toHaveBeenCalledTimes(1);
});
