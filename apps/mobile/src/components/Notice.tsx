import { Modal, Pressable, View } from 'react-native';
import { Button, Copy, Title } from './ui';
import { colors } from '@/constants/theme';

export function Notice({
  title,
  message,
  onClose,
  children,
}: {
  title: string;
  message: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close dialog"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: '#00000066',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: 18,
            padding: 24,
            gap: 18,
            backgroundColor: colors.background,
          }}
        >
          <Title>{title}</Title>
          <Copy>{message}</Copy>
          {children}
          <View>
            <Button label="Close" variant="outline" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
