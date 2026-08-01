export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>سازمان منطقه آزاد — سامانه پرداخت ارزی</p>
        <p>
          پشتیبانی فنی:{" "}
          <a href="mailto:support@afa.local" className="hover:text-foreground" dir="ltr">
            support@afa.local
          </a>
        </p>
      </div>
    </footer>
  );
}
