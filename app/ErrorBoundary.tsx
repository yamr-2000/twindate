import React from "react";
import { View, Text, ScrollView } from "react-native";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("APP CRASH:", error.message);
    console.error("STACK:", error.stack);
    console.error("COMPONENT:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: "#0E0E20", padding: 40, paddingTop: 100 }}>
          <Text style={{ color: "#F5367B", fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>
            App Crashed
          </Text>
          <ScrollView>
            <Text style={{ color: "#FFFFFF", fontSize: 14, marginBottom: 8 }}>
              {this.state.error?.message}
            </Text>
            <Text style={{ color: "#9D9DAE", fontSize: 11 }}>
              {this.state.error?.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}
