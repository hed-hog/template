
const loaderStyles = `
.loader {
  height: 60px;
  aspect-ratio: 1;
  position: relative;
  border: 3px solid #0000;
}
.loader:before {
  content: "";
  position: absolute;
  inset: auto 35% 0;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #ff760c;
  animation: l6-0 .5s cubic-bezier(0,800,1,800) infinite;
}
.loader:after {
  content: "";
  position: absolute;
  inset: 0;
  outline: 3px solid #2e2e2e;
  animation: l6-1 .5s linear infinite;
}
@keyframes l6-0 {
  0%,2% {bottom: 0%}
  98%,to {bottom:.1%}
}
@keyframes l6-1 {
  0%,30% {rotate:  0deg}
  70%,to {rotate: 90deg}
}
`;

export const Loading = () => {
  return (
    <>
      <div className="loader" />
      <style>{loaderStyles}</style>
    </>
  );
}