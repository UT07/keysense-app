declare module 'posthog-react-native' {
  interface PostHogOptions {
    host?: string;
    captureApplicationLifecycleEvents?: boolean;
    recordScreenViews?: boolean;
    enableSessionReplay?: boolean;
    captureLaunchOptions?: boolean;
    [key: string]: unknown;
  }

  const PostHog: {
    setupWithApiKey(apiKey: string, options?: PostHogOptions): void;
    capture(event: string, properties?: Record<string, unknown>): void;
    identify(distinctId: string, properties?: Record<string, unknown>): void;
    setPersonProperties(properties: Record<string, unknown>): void;
    screen(screenName: string, properties?: Record<string, unknown>): void;
    reset(): void;
    flush(): void;
    disable(): void;
    enable(): void;
  };

  export default PostHog;
}
