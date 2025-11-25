export const metadata = {
  title: 'CV',
}

export default function Page() {
  return (
    <section>
      <div className="mb-7 mt-4">
        <span className="block text-rurikon-500">
          <strong>Curriculum vitae</strong>
        </span>
      </div>
      <iframe
        src="/cv_lovegrover.pdf"
        className="w-full h-[800px] border-none"
        title="CV"
      />
    </section>
  )
}
