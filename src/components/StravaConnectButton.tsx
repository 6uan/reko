/**
 * "Connect with Strava" button using their brand assets (orange #FC5200,
 * white text, official wordmark SVG) in a shape that matches our design
 * system's rounded buttons.
 *
 * Two sizes:
 *   sm — navbar: compact pill, wordmark only, no "Connect with" prefix
 *   md — hero CTA: full-width-capable, "Connect with" + wordmark
 *
 * Strava brand guidelines:
 *   https://developers.strava.com/guidelines/
 *   We keep the required orange, white-on-orange contrast, and their
 *   unmodified wordmark — just adapting the container to our border
 *   radius / padding conventions.
 */

import { Link } from '@tanstack/react-router'

/** Strava wordmark extracted from the official btn_strava_connect_with_orange.svg */
function StravaWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="134 15 88 18"
      fill="currentColor"
      className={className}
      aria-label="Strava"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M180.749 31.8195L180.748 31.8188H185.357L188.188 26.1268L191.019 31.8188H196.618L188.187 15.5403L180.184 30.9945L177.111 26.5078C179.008 25.5928 180.191 24.0081 180.191 21.7318V21.687C180.191 20.0803 179.7 18.9197 178.763 17.9822C177.669 16.8887 175.906 16.1968 173.139 16.1968H165.506V31.8195H170.728V27.3558H171.844L174.79 31.8195H180.749ZM212.954 15.5403L204.524 31.8188H210.124L212.955 26.1268L215.786 31.8188H221.385L212.954 15.5403ZM200.576 32.4593L209.006 16.1808H203.406L200.575 21.8729L197.744 16.1808H192.144L200.576 32.4593ZM172.982 23.6287C174.232 23.6287 174.991 23.0708 174.991 22.1112V22.0663C174.991 21.0621 174.21 20.5711 173.005 20.5711H170.728V23.6287H172.982ZM154.337 20.6158H149.74V16.1968H164.157V20.6158H159.56V31.8195H154.337V20.6158ZM137.015 26.1507L134.225 29.4761C136.211 31.2172 139.068 32.1097 142.237 32.1097C146.433 32.1097 149.133 30.101 149.133 26.82V26.7756C149.133 23.6287 146.455 22.468 142.46 21.7318C140.808 21.419 140.384 21.1515 140.384 20.7273V20.6827C140.384 20.3033 140.742 20.0355 141.523 20.0355C142.973 20.0355 144.737 20.5042 146.209 21.5754L148.754 18.0493C146.946 16.6209 144.714 15.9065 141.701 15.9065C137.394 15.9065 135.073 18.2055 135.073 21.1737V21.2185C135.073 24.5214 138.153 25.526 141.656 26.2398C143.33 26.5747 143.821 26.82 143.821 27.2665V27.3113C143.821 27.7352 143.42 27.9805 142.482 27.9805C140.652 27.9805 138.711 27.4452 137.015 26.1507Z"
      />
    </svg>
  )
}

type Props = {
  size: 'sm' | 'md'
  className?: string
}

export default function StravaConnectButton({ size, className = '' }: Props) {
  if (size === 'sm') {
    return (
      <Link
        to="/auth/strava"
        aria-label="Connect with Strava"
        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-(--radius-s) border border-[#FC5200] bg-[#FC5200] text-white no-underline transition-[opacity,border-color] duration-150 ease-out hover:opacity-85 hover:border-[#ff6a1a] ${className}`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          Connect with
        </span>
        <StravaWordmark className="h-2.5 w-auto" />
      </Link>
    )
  }

  return (
    <a
      href="/auth/strava"
      aria-label="Connect with Strava"
      className={`btn inline-flex items-center gap-2 bg-[#FC5200] text-white border-[#FC5200] no-underline transition-[opacity,border-color] duration-150 ease-out hover:opacity-85 hover:border-[#ff6a1a] ${className}`}
    >
      <span className="text-[12px] font-semibold uppercase tracking-wide">
        Connect with
      </span>
      <StravaWordmark className="h-3 w-auto" />
    </a>
  )
}
