import shlex
import subprocess


DEVICE = "/dev/input/by-id/usb-._Controller_00003008002A0028-event-joystick"


def vibrate_sine(duration: float = 1.0) -> None:
    if duration <= 0:
        return

    device = shlex.quote(DEVICE)

    command = (
        f'(echo 0; sleep {duration}; echo -1) '
        f'| sudo -n fftest {device}'
    )

    result = subprocess.run(
        ["bash", "-c", command],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip()
            or f"fftest exited with code {result.returncode}"
        )
